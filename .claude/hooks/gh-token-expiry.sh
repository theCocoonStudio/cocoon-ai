#!/usr/bin/env bash
# SessionStart hook (asyncRewake): wake Claude when the GitHub App installation
# token is about to expire.
#
# run.sh mints GH_TOKEN on the host and then starts the container, so the age of
# the container's PID 1 is the age of the token. Installation tokens live 1 hour.
# The hook sleeps until the token is GH_TOKEN_WARN_SECONDS old (default 50 min),
# then exits 2 so the harness re-wakes Claude with the message on stderr.
# Outside the container (no ghs_ token, or no PID 1 age) it exits 0 and does nothing.

case "${GH_TOKEN:-}" in
  ghs_*) ;;
  *) exit 0 ;;
esac

age=$(ps -o etimes= -p 1 2>/dev/null | tr -d ' ')
case "$age" in
  ''|*[!0-9]*) exit 0 ;;
esac

limit=${GH_TOKEN_WARN_SECONDS:-3000}
left=$((limit - age))
if [ "$left" -gt 0 ]; then
  sleep "$left"
  age=$limit
fi

echo "GH_TOKEN reminder: the GitHub App installation token was minted about $((age / 60)) minutes ago and expires at 60. Tell Izzy now: any push or gh call after that needs a container restart." >&2
exit 2
