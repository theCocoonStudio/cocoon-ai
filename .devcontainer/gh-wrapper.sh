#!/bin/bash
# gh with the current App token. The host re-mints /run/cocoon/token every fifty minutes
# (run.sh), so the token is read here at every call and is never held in the environment
# between calls. With GH_TOKEN already set (a VS Code start) or no token file (a start without
# a key) gh runs as it is. Installed as /usr/local/bin/gh, ahead of /usr/bin/gh on the PATH.
set -euo pipefail
if [ -z "${GH_TOKEN:-}" ] && [ -s /run/cocoon/token ]; then
  GH_TOKEN="$(cat /run/cocoon/token)" exec /usr/bin/gh "$@"
fi
exec /usr/bin/gh "$@"
