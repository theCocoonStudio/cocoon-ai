#!/bin/bash
# =============================================================================
# init-firewall.sh: egress firewall for the Claude sandbox
# =============================================================================
#
# WHY THIS EXISTS
#   The container has no network isolation by construction. Under rootless podman
#   it gets a pasta network that mirrors the host's LAN address (e.g. 192.168.18.2/24),
#   and under Docker/Colima a bridge that can still route to the LAN. Without these
#   rules the agent could reach the router, the box's own ssh port, every device on
#   the LAN, Tailscale peers, and the whole internet. This script is the wall.
#
# THE POLICY, IN ONE PARAGRAPH
#   Default-deny in every direction. Outbound is allowed only to (a) the DNS
#   resolvers the container was started with, on port 53, and (b) an allowlist of
#   IP ranges built at start-up: GitHub's published ranges, plus the current A
#   records of the npm registry and the Anthropic API/login hosts. Everything else,
#   including every private/LAN range, is rejected. Inbound is allowed only for
#   replies to connections we opened. IPv6 is dropped entirely.
#
# HOW IT RUNS
#   entrypoint.sh runs this as root via sudo on every container start; that is the
#   only command the `node` user may sudo (see Dockerfile, /etc/sudoers.d/node-firewall).
#   The container needs CAP_NET_ADMIN and CAP_NET_RAW (run.sh passes them) so that
#   iptables/ipset can be applied inside the container's own network namespace.
#   The rules live in that namespace only; they never touch the host's firewall.
#
# KNOWN LIMITS (accepted, not bugs)
#   - DNS to a recursive resolver is itself a covert channel: query names can carry
#     data out to whoever owns the queried domain. We cannot close this and still
#     resolve api.anthropic.com. It is narrowed to the configured resolvers only.
#   - The allowlist is a snapshot of DNS at start-up. If an allowed host's IP
#     changes mid-session, that host becomes unreachable until the container restarts.
#   - The allowlist is by IP, not by name. Anything else hosted on those IPs
#     (other GitHub repos, other npm packages, other hosts behind the same CDN
#     addresses) is reachable too. Repository scoping is done by the token, not here.
#
# TO CHANGE THE ALLOWLIST
#   Edit the `domain` list in section 4, rebuild the image (run.sh does this), restart.
#   Do not add hosts from inside a session; the agent must not widen its own wall.
# =============================================================================

set -euo pipefail   # Exit on any error, on unset variables, and on failures inside pipes.
IFS=$'\n\t'         # Word-split only on newlines and tabs, never on spaces.

# -----------------------------------------------------------------------------
# 1. Start from a clean slate
# -----------------------------------------------------------------------------
# Every container start runs this script, so flush anything left from a previous
# run (there normally isn't anything: a fresh network namespace is empty). -F flushes
# rules, -X deletes user-defined chains. nat and mangle tables are cleared for
# completeness; we never add rules to them.
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# -----------------------------------------------------------------------------
# 2. Loopback and DNS: the two things that must work before anything else
# -----------------------------------------------------------------------------
# Loopback carries local IPC (Claude Code's own sockets, dev servers on localhost).
iptables -A INPUT  -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# DNS is needed twice: by this script (section 4 resolves the allowlisted hosts) and
# by the agent for the rest of the session (the Anthropic client resolves its host
# on every connection).
#
# Only the resolvers the container was started with are allowed. Previously this
# rule was `-p udp --dport 53` with no destination, which let the agent talk to ANY
# host on UDP 53: the LAN router answered DNS queries from inside the sandbox, and
# any public resolver on the internet was reachable. Restricting the destination
# closes the LAN side of that and reduces the exfil surface to the configured
# resolvers (under pasta that is 169.254.1.1, a forwarder to the host's resolver).
#
# TCP 53 is included because resolvers fall back to TCP for answers larger than
# 512 bytes (GitHub's records, DNSSEC).
resolvers=$(awk '$1 == "nameserver" {print $2}' /etc/resolv.conf)
if [ -z "$resolvers" ]; then
    echo "ERROR: no nameserver in /etc/resolv.conf; refusing to open DNS to the world"
    exit 1
fi
while read -r ns; do
    # Only IPv4 dotted-quad resolvers are supported; IPv6 is dropped below anyway.
    if [[ ! "$ns" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        echo "Skipping non-IPv4 resolver $ns"
        continue
    fi
    echo "Allowing DNS to resolver $ns"
    iptables -A OUTPUT -p udp -d "$ns" --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp -d "$ns" --dport 53 -j ACCEPT
done < <(echo "$resolvers")

# Note what is deliberately NOT here:
#   - No `INPUT -p udp --sport 53 -j ACCEPT`. The old script had it, and it accepted
#     any inbound UDP packet whose source port happened to be 53, from anyone. DNS
#     replies are already covered by the ESTABLISHED,RELATED rule in section 5.
#   - No outbound SSH. GitHub is reached over HTTPS with a scoped token.

# -----------------------------------------------------------------------------
# 3. Reject every private and local range, before the allowlist can say yes
# -----------------------------------------------------------------------------
# This is defence in depth against the LAN. The allowlist in section 5 would already
# block these, but the allowlist is built from data we fetch over the network
# (GitHub's meta endpoint and DNS answers). If either ever returned a private
# address, by mistake, by compromise, or by DNS rebinding, the agent would gain a
# path onto the LAN. Rejecting these ranges first means the allowlist cannot open
# them no matter what it contains. The resolver rule above sits before this block
# on purpose: under pasta the resolver is 169.254.1.1, which is link-local.
#
# REJECT (not DROP) so that a connection attempt fails instantly with an error rather
# than hanging until timeout; the agent gets clear feedback that the wall is there.
for cidr in \
    10.0.0.0/8         `# RFC1918 private` \
    172.16.0.0/12      `# RFC1918 private (also Docker's default bridge range)` \
    192.168.0.0/16     `# RFC1918 private (the box's LAN lives here)` \
    169.254.0.0/16     `# link-local (pasta's resolver is here; allowed above)` \
    100.64.0.0/10      `# CGNAT, used by Tailscale for every peer` \
    224.0.0.0/4        `# multicast (mDNS/SSDP device discovery)` \
    255.255.255.255/32 `# broadcast`; do
    iptables -A OUTPUT -d "$cidr" -j REJECT --reject-with icmp-admin-prohibited
done

# -----------------------------------------------------------------------------
# 4. Build the allowlist: GitHub ranges + resolved IPs of a few named hosts
# -----------------------------------------------------------------------------
# ipset holds the allowed destinations as a set of CIDRs so that a single iptables
# rule (section 5) can match all of them. hash:net accepts both /32 hosts and ranges.
ipset create allowed-domains hash:net

# 4a. GitHub publishes its address ranges at api.github.com/meta. We take the
#     `web`, `api`, and `git` lists (HTTPS to github.com, the REST API, and git over
#     HTTPS). Every entry is validated as an IPv4 CIDR before it is added; a
#     surprising value aborts the script and the container start.
#     `aggregate` merges overlapping/adjacent ranges to keep the set small.
#     IPv6 entries in the feed are dropped by the regex; IPv6 is blocked wholesale.
echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
    echo "ERROR: Failed to fetch GitHub IP ranges"
    exit 1
fi
if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
    echo "ERROR: GitHub API response missing required fields"
    exit 1
fi
echo "Processing GitHub IPs..."
while read -r cidr; do
    if [[ ! "$cidr" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        echo "ERROR: Invalid CIDR range from GitHub meta: $cidr"
        exit 1
    fi
    echo "Adding GitHub range $cidr"
    ipset add -exist allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# 4b. Named hosts, resolved once now. This is the complete list of non-GitHub
#     destinations the agent may talk to:
#       registry.npmjs.org    npm install
#       api.anthropic.com     the model API
#       claude.ai             OAuth login flow
#       platform.claude.com   OAuth login flow / console
#       console.anthropic.com OAuth login flow / console
#     Telemetry hosts (Sentry, Statsig) are deliberately absent;
#     CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 in run.sh stops Claude trying.
#     Each answer is validated as a dotted quad. Private answers would be caught by
#     section 3 anyway, but a host that fails to resolve aborts the start, because
#     starting with a partial allowlist would look like a firewall bug later.
for domain in \
    "registry.npmjs.org" \
    "api.anthropic.com" \
    "claude.ai" \
    "platform.claude.com" \
    "console.anthropic.com"; do
    echo "Resolving $domain..."
    ips=$(dig +noall +answer A "$domain" | awk '$4 == "A" {print $5}')
    if [ -z "$ips" ]; then
        echo "ERROR: Failed to resolve $domain"
        exit 1
    fi
    while read -r ip; do
        if [[ ! "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
            echo "ERROR: Invalid IP from DNS for $domain: $ip"
            exit 1
        fi
        echo "Adding $ip for $domain"
        ipset add -exist allowed-domains "$ip"
    done < <(echo "$ips")
done

# -----------------------------------------------------------------------------
# 5. Default-deny, then the two positive rules that make the sandbox usable
# -----------------------------------------------------------------------------
# Policies apply to any packet no rule matched. DROP everywhere:
#   INPUT   nothing may connect in (no listening service is reachable from the LAN)
#   FORWARD the container never routes for anyone
#   OUTPUT  nothing goes out unless a rule above or below says so
iptables -P INPUT   DROP
iptables -P FORWARD DROP
iptables -P OUTPUT  DROP

# Replies to connections we opened (TCP handshakes, DNS answers, ICMP errors for
# our own packets) are allowed via connection tracking. This is what lets DNS
# answers in now that the blanket sport-53 rule is gone.
iptables -A INPUT  -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# The allowlist. Any protocol/port to these destinations; the destinations are the
# constraint. Section 3 has already rejected private ranges so nothing here can
# reach the LAN.
iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

# Everything else outbound: REJECT with an ICMP error so failures are immediate
# and obvious (a DROP would make every blocked call hang for its full timeout).
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

# -----------------------------------------------------------------------------
# 6. IPv6: block it all
# -----------------------------------------------------------------------------
# The allowlist is IPv4-only, so any IPv6 route would be an unfiltered bypass.
# Today the container has only a link-local v6 address and no default v6 route,
# but that is a property of the host, not of this script, so drop v6 regardless.
# ip6tables may be unavailable if the kernel lacks v6 netfilter; warn, don't fail,
# since in that case there is no v6 stack to leak through either.
if ip6tables -P OUTPUT DROP 2>/dev/null; then
    ip6tables -F
    ip6tables -P INPUT   DROP
    ip6tables -P FORWARD DROP
    ip6tables -P OUTPUT  DROP
    ip6tables -A INPUT  -i lo -j ACCEPT
    ip6tables -A OUTPUT -o lo -j ACCEPT
    echo "IPv6: all traffic dropped except loopback"
else
    echo "WARNING: ip6tables unavailable; IPv6 not filtered (no v6 stack expected)"
fi

# -----------------------------------------------------------------------------
# 7. Self-test: the wall must both hold and not be too high
# -----------------------------------------------------------------------------
# A failed self-test aborts the container start (set -e), which is the right
# failure mode: better no session than a session with a broken wall.
echo "Firewall configuration complete"
echo "Verifying firewall rules..."

# Must be blocked: an ordinary public site.
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - was able to reach https://example.com"
    exit 1
else
    echo "Firewall verification passed - unable to reach https://example.com as expected"
fi

# Must be blocked: the LAN default gateway, on the port DNS uses. This is the
# exact hole that existed before the resolver restriction; keep it tested.
gw=$(ip -4 route show default | awk '{print $3; exit}')
if [ -n "$gw" ] && ! grep -qx "$gw" <<<"$resolvers"; then
    if dig +time=2 +tries=1 @"$gw" github.com A >/dev/null 2>&1; then
        echo "ERROR: Firewall verification failed - LAN gateway $gw answered DNS"
        exit 1
    else
        echo "Firewall verification passed - LAN gateway $gw unreachable on UDP 53"
    fi
fi

# Must work: GitHub.
if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "ERROR: Firewall verification failed - unable to reach https://api.github.com"
    exit 1
else
    echo "Firewall verification passed - able to reach https://api.github.com as expected"
fi
