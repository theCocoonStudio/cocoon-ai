#!/bin/bash
# Build (if needed) and drop into the sandbox. Rootless podman. Usage:
#   cocoon                               # shell, through the installed launcher (host/cocoon-launch.sh)
#   cocoon claude                        # straight into Claude, as the cocoon-claude App
#   cocoon gemini                        # straight into Gemini, as the cocoon-gemini App
#
# The launcher downloads main and runs this script from that download; nothing on the
# host comes from the agent's working tree, which lives in a container volume
# (cocoon-ai-workspace) the entrypoint clones on first start. An admin with git may run
# .devcontainer/run.sh from a checkout they have reviewed; the login user has no git.
#
# GitHub access: a GitHub App installation token, minted HERE on the host from the App's
# private key, and passed into the container as GH_TOKEN. The key never enters the sandbox.
# The token is valid for 1 hour; a session that outlives it loses push/PR access until
# run.sh is started again. Everything the agent does on GitHub is attributed to the bot user.
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
if [ "$AGENT" = gemini ]; then
  APP_ID=                                                           # the cocoon-gemini GitHub App: set by PR once the App exists; empty means no credential
  APP_KEY="$HOME/cocoon-gemini.private-key.pem"                     # its private key, host only, mode 600
  BOT_NAME="cocoon-gemini[bot]"
  BOT_EMAIL="0+cocoon-gemini[bot]@users.noreply.github.com"         # the bot user id replaces 0 by PR, with APP_ID
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
  curl      # the GitHub API, for the installation token
  jq        # reads the API's JSON
)
for tool in "${TOOLS[@]}"; do
  command -v "$tool" >/dev/null || { echo "run.sh: '$tool' is required on the host" >&2; exit 1; }
done

# Always show the build log. Cached runs print one short line per step; a real rebuild shows everything.
podman build -t "$IMAGE" "$DEVCONTAINER"

# --- Mint a 1-hour installation token for the App (host side, key stays here) ---------------
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
gh_api() { curl -fsS -H "Authorization: Bearer $1" -H "Accept: application/vnd.github+json" \
                 -H "X-GitHub-Api-Version: 2022-11-28" "${@:2}"; }

GH_TOKEN=""
if [ -z "$APP_ID" ]; then
  echo "github: no App id for $BOT_NAME yet (set it by PR); starting without a credential" >&2
elif [ ! -r "$APP_KEY" ]; then
  echo "github: App key not readable at $APP_KEY; starting without a credential" >&2
else
  perms=$(stat -c %a "$APP_KEY")
  [ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "github: WARNING $APP_KEY has mode $perms; chmod 600 it" >&2

  # JWT signed with the App key, valid 9 minutes (iat backdated 60s for clock skew).
  now=$(date +%s)
  header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
  payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((now - 60))" "$((now + 540))" "$APP_ID" | b64url)
  sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -sign "$APP_KEY" -binary | b64url)
  jwt="$header.$payload.$sig"

  # The installation of this App on the studio account, then a token for it.
  inst=$(gh_api "$jwt" "$API/app/installations" \
         | jq -r --arg a "$APP_ACCOUNT" '.[] | select(.account.login == $a) | .id' | head -1)
  [ -n "$inst" ] || { echo "github: App $APP_ID has no installation on $APP_ACCOUNT" >&2; exit 1; }
  resp=$(gh_api "$jwt" -X POST "$API/app/installations/$inst/access_tokens")
  GH_TOKEN=$(printf '%s' "$resp" | jq -r .token)
  echo "github: installation token minted for $APP_ACCOUNT as $BOT_NAME, expires $(printf '%s' "$resp" | jq -r .expires_at)"
  echo "github: repos: $(printf '%s' "$resp" | jq -r '.repository_selection')"
  unset jwt sig payload header resp
fi
export GH_TOKEN   # read by podman via `-e GH_TOKEN` below; the value is never on a command line

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

exec podman run -it --rm \
  --name "$CONTAINER" \
  --userns=keep-id:uid=1000,gid=1000 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v "$WORKSPACE_VOLUME:/workspace" \
  -v "$CONFIG_VOLUME" \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude \
  -e DISABLE_AUTOUPDATER=1 \
  -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  -e GIT_AUTHOR_NAME="$BOT_NAME" -e GIT_COMMITTER_NAME="$BOT_NAME" \
  -e GIT_AUTHOR_EMAIL="$BOT_EMAIL" -e GIT_COMMITTER_EMAIL="$BOT_EMAIL" \
  -e GH_TOKEN \
  "${AGENT_ENV[@]}" \
  "$IMAGE" "$@"
