#!/bin/bash
# Runs as `node` on every container start.
set -euo pipefail

sudo /usr/local/bin/init-firewall.sh

# If a GitHub token was passed in the environment, let git push through gh.
# The token lives only in this process's env; nothing is written to disk.
if [ -n "${GH_TOKEN:-}" ]; then
  gh auth setup-git >/dev/null
  echo "gh: authenticated as $(gh api user -q .login 2>/dev/null || echo '?')"
else
  echo "gh: no GH_TOKEN set; git push / gh pr will not work this session"
fi

# Linux needs its own node_modules (host copy has darwin-arm64 binaries).
if [ -f package-lock.json ] && [ ! -f node_modules/.package-lock.json ]; then
  echo "npm ci (first run in this volume)..."
  npm ci --no-audit --no-fund
fi

exec "$@"
