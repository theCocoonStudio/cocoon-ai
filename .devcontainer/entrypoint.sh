#!/bin/bash
# Runs as `node` on every container start.
set -euo pipefail

sudo /usr/local/bin/init-firewall.sh

# GH_TOKEN, if set, is a GitHub App installation token minted on the host by run.sh
# (1-hour lifetime) or a fine-grained PAT. It lives only in this process's env; nothing is
# written to disk. The App's private key is never mounted here.
if [ -n "${GH_TOKEN:-}" ]; then
  gh auth setup-git >/dev/null
  case "$GH_TOKEN" in
    ghs_*) # installation token: no /user endpoint, list what it can reach instead
      echo "gh: GitHub App installation token; repos: $(gh api installation/repositories -q '[.repositories[].full_name] | join(", ")' 2>/dev/null || echo '?')"
      echo "gh: token expires within 1 hour of container start; restart run.sh for a new one" ;;
    *)
      echo "gh: authenticated as $(gh api user -q .login 2>/dev/null || echo '?')" ;;
  esac
else
  echo "gh: no GH_TOKEN set; git push / gh pr will not work this session"
fi

# node_modules lives in a named volume, not the bind-mounted repo: installed once, persists across runs.
if [ -f package-lock.json ] && [ ! -f node_modules/.package-lock.json ]; then
  echo "npm ci (first run in this volume)..."
  npm ci --no-audit --no-fund
fi

exec "$@"
