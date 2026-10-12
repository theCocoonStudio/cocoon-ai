#!/bin/bash
# SessionStart hook: the agent CLIs are pinned in the sandbox image (cocoon-agent-sandbox,
# sandbox/Dockerfile, ARG *_VERSION), so nothing updates itself; this prints, once per session,
# which installed CLI has a newer release on npm, so the bump can be proposed as a PR there
# with the changelog read. Asked for by Izzy on #42 and #45 (2026-10-02). The installed
# version is read from the CLI itself (the image is the pin), since this repository no
# longer carries the Dockerfile (2026-10-11). Output goes to the agent's context.
set -uo pipefail

# command -> npm package; add a line when a new CLI joins the image
declare -A PACKAGES=(
  [claude]=@anthropic-ai/claude-code
  [gemini]=@google/gemini-cli
)

out=""
for cmd in "${!PACKAGES[@]}"; do
  command -v "$cmd" >/dev/null || continue
  pinned=$(timeout 20 "$cmd" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)
  [ -n "$pinned" ] || continue
  pkg=${PACKAGES[$cmd]}
  latest=$(timeout 20 npm view "$pkg" version 2>/dev/null || true)
  if [ -z "$latest" ]; then
    out+="version-check: $pkg installed $pinned; npm unreachable, latest unknown"$'\n'
  elif [ "$latest" != "$pinned" ]; then
    out+="version-check: $pkg installed $pinned, latest $latest: a bump is a PR to cocoon-agent-sandbox's sandbox/Dockerfile with the changelog read"$'\n'
  fi
done
command -v shellcheck >/dev/null || out+="lint-bash: shellcheck is not in this image, so Bash commands run unlinted this session; the sandbox image carries it"$'\n'
[ -n "$out" ] && printf '%s' "$out"
exit 0
