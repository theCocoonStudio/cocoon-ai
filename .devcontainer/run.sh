#!/bin/bash
# Build (if needed) and drop into the sandbox. Rootless podman. Usage:
#   .devcontainer/run.sh                                 # shell, no GitHub access
#   .devcontainer/run.sh claude                          # straight into Claude
#   env $(cat ~/.tokens) .devcontainer/run.sh claude     # with GH_TOKEN from a 600-mode file
#   read -rs GH_TOKEN && export GH_TOKEN && .devcontainer/run.sh claude   # or typed, no echo
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=cocoon-ai-sandbox
podman build -q -t "$IMAGE" .devcontainer >/dev/null

exec podman run -it --rm \
  --name cocoon-ai-sandbox \
  --userns=keep-id:uid=1000,gid=1000 \
  --cap-add NET_ADMIN --cap-add NET_RAW \
  -v "$PWD":/workspace \
  -v cocoon-ai-node-modules:/workspace/node_modules \
  -v cocoon-ai-claude-config:/home/node/.claude \
  -e CLAUDE_CONFIG_DIR=/home/node/.claude \
  -e DISABLE_AUTOUPDATER=1 \
  -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
  -e GIT_AUTHOR_NAME="Izzy Erlich" -e GIT_COMMITTER_NAME="Izzy Erlich" \
  -e GIT_AUTHOR_EMAIL="izzy@thecocoon.studio" -e GIT_COMMITTER_EMAIL="izzy@thecocoon.studio" \
  -e GH_TOKEN \
  "$IMAGE" "$@"
