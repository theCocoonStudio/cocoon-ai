#!/bin/bash
# Build (if needed) and drop into the sandbox. Rootless podman. Usage:
#   cocoon                               # shell, through the installed launcher (host/cocoon-launch.sh)
#   cocoon claude                        # straight into Claude, as the cocoon-claude App
#   cocoon gemini                        # straight into Gemini, as the cocoon-gemini App
#   cocoon claude -- --research          # the same, with the "research" hosts list on for this session
#   cocoon claude --continue -- --research   # flags before `--` go to the agent, after it to the sandbox
#
# The launcher downloads main and runs this script from that download; nothing on the
# host comes from the agent's working tree, which lives in a container volume
# (cocoon-ai-workspace) the entrypoint clones on first start. An admin with git may run
# .devcontainer/run.sh from a checkout they have reviewed; the login user has no git.
#
# GitHub access: a GitHub App installation token, minted HERE on the host from the App's
# private key. The key never enters the sandbox. A token lives one hour, so this script keeps
# minting: the current token is written to a tmpfs file the container mounts read-only
# (/run/cocoon/token) and re-minted every fifty minutes for as long as the container runs;
# the container's gh and git read the file at each call (the wrappers in the image), so a
# session of any length keeps its push and PR access, and nothing holds the token in an
# environment variable. Until 2026-10-11 the token went in as GH_TOKEN and died with its hour,
# and the restart that renewed it killed whatever was running. Everything the agent does on
# GitHub is attributed to the bot user.
#
# Nothing here is configurable from the environment: every value is hardcoded below and a
# change is a PR (Izzy, 2026-10-02). The build context is this script's own directory,
# which is the launcher's download of main.
set -euo pipefail
DEVCONTAINER="$(dirname "$0")"

# --- Everything this script knows, in one place ---------------------------------------------
# Two agents, two GitHub Apps, one image. The first argument names the agent; each gets its
# own bot identity, its own workspace and config volumes, its own container name, and only
# its own model host in the firewall. Both may run at once.
IMAGE=cocoon-ai-sandbox
APP_ACCOUNT=theCocoonStudio                                         # the account both Apps are installed on
API=https://api.github.com
AGENT=claude
[ "${1:-}" = gemini ] && AGENT=gemini
# Named configs: hosts lists in .devcontainer/configs/ that are off by default and turned on
# for one session from this command line, after `--`. The names are hardcoded here; an
# unknown one is an error, not a silent default.
KNOWN_CONFIGS=(research)
COMMAND=()
CONFIG_ARGS=()
while [ $# -gt 0 ] && [ "$1" != -- ]; do COMMAND+=("$1"); shift; done
if [ "${1:-}" = -- ]; then
  shift
  for flag in "$@"; do
    name="${flag#--}"
    known=0
    for c in "${KNOWN_CONFIGS[@]}"; do [ "$c" = "$name" ] && known=1; done
    [ "$known" = 1 ] || { echo "run.sh: unknown config '$flag' (known: ${KNOWN_CONFIGS[*]})" >&2; exit 1; }
    CONFIG_ARGS+=(--config "$name")
  done
fi
set -- "${COMMAND[@]}"
if [ "$AGENT" = gemini ]; then
  APP_ID=5200600                                                    # the cocoon-gemini GitHub App
  APP_KEY="$HOME/cocoon-gemini.private-key.pem"                     # its private key, host only, mode 600
  BOT_NAME="cocoon-gemini[bot]"
  BOT_EMAIL="338248646+cocoon-gemini[bot]@users.noreply.github.com" # <bot user id>+<slug>[bot]@users.noreply.github.com
  CONTAINER=cocoon-ai-sandbox-gemini
  WORKSPACE_VOLUME=cocoon-ai-workspace-gemini
  CONFIG_VOLUME=cocoon-ai-gemini-config:/home/node/.gemini
  TOKENS_FILE="$HOME/.tokens"                                       # one line, GEMINI_API_KEY=..., mode 600; read, never sourced
else
  APP_ID=4819921                                                    # the cocoon-claude GitHub App
  APP_KEY="$HOME/cocoon-claude.2026-09-03.private-key.pem"          # its private key, host only, mode 600
  BOT_NAME="cocoon-claude[bot]"
  BOT_EMAIL="324573615+cocoon-claude[bot]@users.noreply.github.com" # <bot user id>+<slug>[bot]@users.noreply.github.com
  CONTAINER=cocoon-ai-sandbox
  WORKSPACE_VOLUME=cocoon-ai-workspace
  CONFIG_VOLUME=cocoon-ai-claude-config:/home/node/.claude
fi
TOOLS=(
  podman    # builds the image and runs the container
  openssl   # signs the App JWT
  curl      # the GitHub API, for the installation token (at start and at every re-mint)
  jq        # reads the API's JSON
)
for tool in "${TOOLS[@]}"; do
  command -v "$tool" >/dev/null || { echo "run.sh: '$tool' is required on the host" >&2; exit 1; }
done

# Always show the build log. Cached runs print one short line per step; a real rebuild shows everything.
podman build -t "$IMAGE" "$DEVCONTAINER"

# --- The App token: minted here, written to tmpfs, re-minted while the container runs -------
# TOKEN_DIR is on the user's tmpfs (/run/user/<uid>, systemd's), one directory per agent so each
# container sees only its own token, mode 700 and the file 600: a token never touches a disk and
# no other user reads it. The container mounts it read-only at /run/cocoon.
TOKEN_DIR="/run/user/$(id -u)/cocoon/$AGENT"
[ -d "/run/user/$(id -u)" ] || { echo "run.sh: no /run/user/$(id -u) (the user's tmpfs); the token file needs it" >&2; exit 1; }
mkdir -p "$TOKEN_DIR" && chmod 700 "$TOKEN_DIR" && rm -f "$TOKEN_DIR/token" "$TOKEN_DIR/expires_at"
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
gh_api() { curl -fsS -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "${@:2}"; }

mint_token() {
  # A JWT signed with the App key, valid 9 minutes (iat backdated 60s for clock skew); the
  # installation of this App on the studio account; a 1-hour token for it, written atomically
  # (a temp file in the same directory, then mv, so the container reads the old or the new, never
  # a half). Prints nothing secret; returns 1 on any failure so the caller can say so.
  local now header payload sig jwt inst resp token expires tmp
  now=$(date +%s)
  header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((now - 60))" "$((now + 540))" "$APP_ID" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -sign "$APP_KEY" -binary | b64url) || return 1
  jwt="$header.$payload.$sig"
  inst=$(gh_api "$jwt" "$API/app/installations" \
         | jq -r --arg a "$APP_ACCOUNT" '.[] | select(.account.login == $a) | .id' | head -1) || return 1
  [ -n "$inst" ] || { echo "github: App $APP_ID has no installation on $APP_ACCOUNT" >&2; return 1; }
  resp=$(gh_api "$jwt" -X POST "$API/app/installations/$inst/access_tokens") || return 1
  token=$(printf '%s' "$resp" | jq -r .token)
  expires=$(printf '%s' "$resp" | jq -r .expires_at)
  [ -n "$token" ] && [ "$token" != null ] || return 1
  tmp=$(mktemp "$TOKEN_DIR/.token.XXXXXX") && chmod 600 "$tmp" && printf '%s' "$token" > "$tmp" && mv -f "$tmp" "$TOKEN_DIR/token" || return 1
  printf '%s' "$expires" > "$TOKEN_DIR/expires_at"
  echo "github: installation token minted for $APP_ACCOUNT as $BOT_NAME, expires $expires; repos: $(printf '%s' "$resp" | jq -r '.repository_selection')"
}

HAVE_KEY=0
if [ -z "$APP_ID" ]; then
  echo "github: no App id for $BOT_NAME yet (set it by PR); starting without a credential" >&2
elif [ ! -r "$APP_KEY" ]; then
  echo "github: App key not readable at $APP_KEY; starting without a credential" >&2
else
  perms=$(stat -c %a "$APP_KEY")
  [ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "github: WARNING $APP_KEY has mode $perms; chmod 600 it" >&2
  mint_token || { echo "github: could not mint the first token" >&2; exit 1; }
  HAVE_KEY=1
fi

refresh_tokens() {
  # Host side, in the background while the container runs: re-mint every fifty minutes (ten
  # before the token dies); on a failure retry in five; stop when the container is gone.
  local delay=3000
  while sleep "$delay"; do
    podman container exists "$CONTAINER" 2>/dev/null || break
    if mint_token; then delay=3000; else echo "github: re-mint failed; the token in place dies at $(cat "$TOKEN_DIR/expires_at" 2>/dev/null || echo '?'); retrying in five minutes" >&2; delay=300; fi
  done
}

# --- The Gemini API key, same discipline: from the tokens file into the container's -----------
# --- environment only, and only for the Gemini agent. -----------------------------------------
AGENT_ENV=()
if [ "$AGENT" = gemini ]; then
  GEMINI_API_KEY=""
  if [ -r "$TOKENS_FILE" ]; then
    perms=$(stat -c %a "$TOKENS_FILE")
    [ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "gemini: WARNING $TOKENS_FILE has mode $perms; chmod 600 it" >&2
    GEMINI_API_KEY=$(grep -m1 '^GEMINI_API_KEY=' "$TOKENS_FILE" | cut -d= -f2-)
  fi
  [ -n "$GEMINI_API_KEY" ] || echo "gemini: no GEMINI_API_KEY line in $TOKENS_FILE; starting without one" >&2
  export GEMINI_API_KEY
  AGENT_ENV=(-e GEMINI_API_KEY)
fi

# The refresher starts just before the container and ends with it; the token directory is
# removed when the container exits, so no token outlives the session on the host either.
REFRESHER=""
[ "$HAVE_KEY" = 1 ] && { refresh_tokens & REFRESHER=$!; }
status=0
podman run -it --rm \
  --name "$CONTAINER" \
  --userns=keep-id:uid=1000,gid=1000 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v "$WORKSPACE_VOLUME:/workspace" \
  -v "$CONFIG_VOLUME" \
  -v "$TOKEN_DIR:/run/cocoon:ro" \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude \
  -e DISABLE_AUTOUPDATER=1 \
  -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  -e GIT_AUTHOR_NAME="$BOT_NAME" -e GIT_COMMITTER_NAME="$BOT_NAME" \
  -e GIT_AUTHOR_EMAIL="$BOT_EMAIL" -e GIT_COMMITTER_EMAIL="$BOT_EMAIL" \
  "${AGENT_ENV[@]}" \
  "$IMAGE" "${CONFIG_ARGS[@]}" "$@" || status=$?
[ -n "$REFRESHER" ] && kill "$REFRESHER" 2>/dev/null
rm -rf "$TOKEN_DIR"
exit "$status"
