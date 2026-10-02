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

# The workspace is a named volume, not a bind mount of anything on the host: the repo is
# cloned into it on the first start and kept across runs and image rebuilds. Branches and
# commits here reach the host only through GitHub, behind the ruleset's review.
if [ ! -d /workspace/.git ]; then
  echo "cloning cocoon-ai into the workspace volume (first start)..."
  git clone -q https://github.com/theCocoonStudio/cocoon-ai.git /workspace
fi
cd /workspace

# Dependencies: npm ci whenever the lockfile differs from the one last installed, which
# also wipes node_modules, so a package pulled in by an old lockfile does not outlive it.
# Lifecycle scripts are refused by the image's npm config (ignore-scripts); the lockfile
# has no package that needs one (checked 2026-10-02, all 335 tests green without).
if [ -f package-lock.json ]; then
  want=$(sha256sum package-lock.json | cut -d' ' -f1)
  have=$(cat node_modules/.cocoon-lockfile-sha 2>/dev/null || true)
  if [ "$want" != "$have" ]; then
    echo "npm ci (lockfile changed or first start)..."
    npm ci --no-audit --no-fund
    echo "$want" > node_modules/.cocoon-lockfile-sha
  fi
fi

# cocoon-ai-records (exports, the logs) and cocoon-ml are cloned beside the workspace on
# the first start that has a token. /home/node is not a volume: a fresh container
# re-clones, and local branches not pushed are lost (the records convention says so).
for repo in cocoon-ai-records cocoon-ml; do
  dir=/home/node/$repo
  if [ -n "${GH_TOKEN:-}" ] && [ ! -d "$dir/.git" ]; then
    echo "cloning $repo (first start in this container)..."
    gh repo clone "theCocoonStudio/$repo" "$dir" -- -q || echo "clone of $repo failed; will retry next start"
  fi
done

exec "$@"
