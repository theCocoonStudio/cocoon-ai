#!/bin/bash
# Build (if needed) and drop into the sandbox. Rootless podman. Usage:
#   .devcontainer/run.sh                                 # shell, no GitHub access
#   .devcontainer/run.sh claude                          # straight into Claude
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=cocoon-ai-sandbox
# Always show the build log. Cached runs print one short line per step; a real rebuild shows everything.
podman build -t "$IMAGE" .devcontainer

# The node_modules volume mounts INSIDE the bind-mounted repo. Under keep-id the runtime
# (container root, not you) cannot create that mountpoint in a directory you own, so make it here.
mkdir -p node_modules

exec podman run -it --rm \
  --name cocoon-ai-sandbox \
  --userns=keep-id:uid=1000,gid=1000 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v /home/izzy/cocoon-claude.2026-09-03.private-key.pem:/etc/github/bot.pem \
  -v "$PWD":/workspace \
  -v cocoon-ai-node-modules:/workspace/node_modules \
  -v cocoon-ai-claude-config:/home/node/.claude \
  -e CLAUDE_APP_ID="4819921" \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude \
  -e DISABLE_AUTOUPDATER=1 \
  -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  -e GIT_AUTHOR_NAME="claude-sandbox-bot[bot]" -e GIT_COMMITTER_NAME="claude-sandbox-bot[bot]" \
  -e GIT_AUTHOR_EMAIL="${CLAUDE_APP_ID}+claude-sandbox-bot[bot]@://github.com"  \
  -e GIT_COMMITTER_EMAIL="${CLAUDE_APP_ID}+claude-sandbox-bot[bot]@://github.com" \
  "$IMAGE" "$@"
