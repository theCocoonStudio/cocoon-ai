#!/bin/bash
# SessionStart hook: the agent CLIs are pinned in .devcontainer/Dockerfile (ARG *_VERSION),
# so nothing updates itself; this prints, once per session, which pins have a newer
# release on npm, so the bump can be proposed as a PR with the changelog read.
# Asked for by Izzy on #42 and #45 (2026-10-02). Output goes to the agent's context.
set -uo pipefail
dockerfile="${CLAUDE_PROJECT_DIR:-/workspace}/.devcontainer/Dockerfile"
[ -r "$dockerfile" ] || exit 0

# ARG name -> npm package; add a line when a new CLI is pinned
declare -A PACKAGES=(
  [CLAUDE_CODE_VERSION]=@anthropic-ai/claude-code
  [GEMINI_CLI_VERSION]=@google/gemini-cli
)

out=""
for arg in "${!PACKAGES[@]}"; do
  pinned=$(sed -n "s/^ARG $arg=\(.*\)$/\1/p" "$dockerfile" | head -1)
  [ -n "$pinned" ] || continue
  pkg=${PACKAGES[$arg]}
  latest=$(timeout 20 npm view "$pkg" version 2>/dev/null || true)
  if [ -z "$latest" ]; then
    out+="version-check: $pkg pinned $pinned; npm unreachable, latest unknown"$'\n'
  elif [ "$latest" != "$pinned" ]; then
    out+="version-check: $pkg pinned $pinned, latest $latest: a bump is a PR to .devcontainer/Dockerfile with the changelog read"$'\n'
  fi
done
[ -n "$out" ] && printf '%s' "$out"
exit 0
