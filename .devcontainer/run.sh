#!/bin/bash
# Build (if needed) and drop into the sandbox. Usage:
#   GH_TOKEN=$(pbpaste) .devcontainer/run.sh          # with GitHub access (macOS)
#   read -rs GH_TOKEN && export GH_TOKEN && .devcontainer/run.sh   # Linux: type/paste token, no echo
#   .devcontainer/run.sh                              # without
#   .devcontainer/run.sh claude                       # straight into Claude
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE=cocoon-ai-sandbox
docker build -q -t "$IMAGE" .devcontainer >/dev/null

exec docker run -it --rm \
  --name cocoon-ai-sandbox \
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
