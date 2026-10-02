#!/bin/bash
# Build (if needed) and drop into the sandbox. Rootless podman. Usage:
#   .devcontainer/run.sh                 # shell
#   .devcontainer/run.sh claude          # straight into Claude
#   .devcontainer/run.sh gemini          # straight into Gemini, as the cocoon-gemini App
#
# GitHub access: a GitHub App installation token, minted HERE on the host from the App's
# private key, and passed into the container as GH_TOKEN. The key never enters the sandbox.
# The token is valid for 1 hour; a session that outlives it loses push/PR access until
# run.sh is started again. Everything the agent does on GitHub is attributed to the bot user.
#
# Two agents, two GitHub Apps, one image. Each run is one agent in its own container with
# its own bot identity, its own config volume and only its own model host in the firewall.
# Both bind-mount this working tree, so run one at a time, or clone twice.
#
# Override any of these in the environment if the defaults move:
#   COCOON_APP_ID, COCOON_APP_KEY, COCOON_APP_ACCOUNT, COCOON_INSTALLATION_ID       (claude)
#   COCOON_GEMINI_APP_ID, COCOON_GEMINI_APP_KEY, COCOON_GEMINI_BOT_ID               (gemini)
#   GEMINI_API_KEY, or a line GEMINI_API_KEY=... in ~/.tokens (mode 600)             (gemini)
#   COCOON_NO_GITHUB=1  -> skip minting, start with no GitHub credential
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=cocoon-ai-sandbox
APP_ACCOUNT="${COCOON_APP_ACCOUNT:-theCocoonStudio}"

AGENT=claude
[ "${1:-}" = gemini ] && AGENT=gemini
if [ "$AGENT" = gemini ]; then
  APP_ID="${COCOON_GEMINI_APP_ID:-}"
  APP_KEY="${COCOON_GEMINI_APP_KEY:-$HOME/cocoon-gemini.private-key.pem}"
  BOT_NAME="cocoon-gemini[bot]"
  BOT_EMAIL="${COCOON_GEMINI_BOT_ID:-0}+cocoon-gemini[bot]@users.noreply.github.com"   # <bot user id>+<slug>[bot]@...
  CONTAINER=cocoon-ai-sandbox-gemini
  CONFIG_VOLUME=cocoon-ai-gemini-config:/home/node/.gemini
else
  APP_ID="${COCOON_APP_ID:-4819921}"
  APP_KEY="${COCOON_APP_KEY:-$HOME/cocoon-claude.2026-09-03.private-key.pem}"
  BOT_NAME="cocoon-claude[bot]"
  BOT_EMAIL="324573615+cocoon-claude[bot]@users.noreply.github.com"   # <bot user id>+<slug>[bot]@users.noreply.github.com
  CONTAINER=cocoon-ai-sandbox
  CONFIG_VOLUME=cocoon-ai-claude-config:/home/node/.claude
fi
API=https://api.github.com

# Always show the build log. Cached runs print one short line per step; a real rebuild shows everything.
podman build -t "$IMAGE" .devcontainer

# The node_modules volume mounts INSIDE the bind-mounted repo. Under keep-id the runtime
# (container root, not you) cannot create that mountpoint in a directory you own, so make it here.
mkdir -p node_modules

# --- Mint a 1-hour installation token for the App (host side, key stays here) ---------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
gh_api() { curl -fsS -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "${@:2}"; }

GH_TOKEN=""
if [ "${COCOON_NO_GITHUB:-0}" = "1" ]; then
  echo "github: COCOON_NO_GITHUB=1, starting without a credential"
elif [ -z "$APP_ID" ]; then
  echo "github: no App id for $BOT_NAME (set COCOON_GEMINI_APP_ID); starting without a credential" >&2
elif [ ! -r "$APP_KEY" ]; then
  echo "github: App key not readable at $APP_KEY; starting without a credential" >&2
else
  for tool in openssl curl jq; do
    command -v "$tool" >/dev/null || { echo "github: '$tool' is required on the host to mint the App token" >&2; exit 1; }
  done
  perms=$(stat -c %a "$APP_KEY")
  [ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "github: WARNING $APP_KEY has mode $perms; chmod 600 it" >&2

  # JWT signed with the App key, valid 9 minutes (iat backdated 60s for clock skew).
  now=$(date +%s)
  header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((now - 60))" "$((now + 540))" "$APP_ID" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -sign "$APP_KEY" -binary | b64url)
  jwt="$header.$payload.$sig"

  # The installation of this App on the studio account, then a token for it.
  inst="${COCOON_INSTALLATION_ID:-}"
  if [ -z "$inst" ]; then
    inst=$(gh_api "$jwt" "$API/app/installations" \
           | jq -r --arg a "$APP_ACCOUNT" '.[] | select(.account.login == $a) | .id' | head -1)
    [ -n "$inst" ] || { echo "github: App $APP_ID has no installation on $APP_ACCOUNT" >&2; exit 1; }
  fi
  resp=$(gh_api "$jwt" -X POST "$API/app/installations/$inst/access_tokens")
  GH_TOKEN=$(printf '%s' "$resp" | jq -r .token)
  echo "github: installation token minted for $APP_ACCOUNT as $BOT_NAME, expires $(printf '%s' "$resp" | jq -r .expires_at)"
  echo "github: repos: $(printf '%s' "$resp" | jq -r '.repository_selection')"
  unset jwt sig payload header resp
fi
export GH_TOKEN   # read by podman via `-e GH_TOKEN` below; the value is never on a command line

# --- The Gemini API key, same discipline: from the environment or ~/.tokens, into the ------
# --- container's env only, and only for the Gemini agent. ------------------------------------
AGENT_ENV=(-e COCOON_AGENT="$AGENT")
if [ "$AGENT" = gemini ]; then
  GEMINI_API_KEY="${GEMINI_API_KEY:-}"
  if [ -z "$GEMINI_API_KEY" ] && [ -r "$HOME/.tokens" ]; then
    perms=$(stat -c %a "$HOME/.tokens")
    [ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "gemini: WARNING ~/.tokens has mode $perms; chmod 600 it" >&2
    GEMINI_API_KEY=$(grep -m1 '^GEMINI_API_KEY=' "$HOME/.tokens" | cut -d= -f2-)   # read, not sourced
  fi
  [ -n "$GEMINI_API_KEY" ] || echo "gemini: no GEMINI_API_KEY in the environment or ~/.tokens; starting without one" >&2
  export GEMINI_API_KEY
  AGENT_ENV+=(-e GEMINI_API_KEY)
fi

exec podman run -it --rm \
  --name "$CONTAINER" \
  --userns=keep-id:uid=1000,gid=1000 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v "$PWD":/workspace \
  -v cocoon-ai-node-modules:/workspace/node_modules \
  -v "$CONFIG_VOLUME" \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude \
  -e DISABLE_AUTOUPDATER=1 \
  -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  -e GIT_AUTHOR_NAME="$BOT_NAME" -e GIT_COMMITTER_NAME="$BOT_NAME" \
  -e GIT_AUTHOR_EMAIL="$BOT_EMAIL" -e GIT_COMMITTER_EMAIL="$BOT_EMAIL" \
  -e GH_TOKEN \
  "${AGENT_ENV[@]}" \
  "$IMAGE" "$@"
