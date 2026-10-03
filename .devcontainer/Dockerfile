# Sandbox for running Claude Code against this repo.
# Based on anthropics/claude-code/.devcontainer, trimmed to what we need.
FROM node:22

ARG TZ=America/New_York
ENV TZ="$TZ"
# Pinned; bump on purpose, with the changelog read. 2.1.287 was the image's version on 2026-10-02.
ARG CLAUDE_CODE_VERSION=2.1.287
# Gemini CLI, pinned the same way. 0.62.0 audited 2026-10-02: npm audit clean, Apache-2.0,
# one bundle, no runtime dependencies. The version hook reports when npm moves past it.
ARG GEMINI_CLI_VERSION=0.62.0

RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl git gh jq less nano procps sudo \
  iptables ipset iproute2 dnsutils aggregate \
  chromium \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
# chromium: the headless browser `npm run export:logo-group` screenshots its
# WebGL render with (SwiftShader, no GPU), driven by puppeteer-core from npm.
# Nothing else in the sandbox uses it.

# Global npm installs go somewhere the non-root user owns.
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

RUN mkdir -p /workspace /home/node/.claude /home/node/.gemini /home/node/cocoon-ai-records \
  && chown -R node:node /workspace /home/node/.claude /home/node/.gemini /home/node/cocoon-ai-records
WORKDIR /workspace

ENV DEVCONTAINER=true
ENV EDITOR=nano VISUAL=nano

# Firewall script may be run via sudo by `node`, and nothing else.
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
# Gemini CLI system settings, read before the user's own and root-owned, so the agent cannot
# change them. Each line is a gate kept or a leak closed; none is a convenience:
#   general.enableAutoUpdate false      the pin above is the update; nothing updates itself
#   privacy.usageStatisticsEnabled false its telemetry host (play.googleapis.com) is outside the firewall too
#   security.auth.selectedType          API-key auth, the one mode whose only host is in the allowlist
# Folder trust stays ON (the CLI's default): an untrusted folder's own settings, hooks and
# extensions are ignored and auto-approval may not edit there. The first `cocoon gemini`
# asks once to trust /workspace; the answer lives in the gemini config volume.
COPY gemini-settings.json /etc/gemini-cli/settings.json
RUN chmod 0755 /usr/local/bin/init-firewall.sh /usr/local/bin/entrypoint.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall \
  && chmod 0440 /etc/sudoers.d/node-firewall

USER node
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  @google/gemini-cli@${GEMINI_CLI_VERSION}
# After the global installs: the agent's npm never runs a package's install scripts.
# The repo's lockfile needs none (checked 2026-10-02); a dependency that does is a
# deliberate, reviewed exception, not a default.
RUN npm config set ignore-scripts true

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
