#!/bin/bash
# Diagnose a "container create failed (no logs from conmon)" error.
# Runs the image with the same flags as run.sh but skips the entrypoint.
cd "$(dirname "$0")/.."
IMAGE=cocoon-ai-sandbox
{
  echo "== podman version =="; podman version
  echo; echo "== runtime =="
  podman info --format '{{.Host.OCIRuntime.Name}} {{.Host.OCIRuntime.Version}} cgroup={{.Host.CgroupsVersion}}'
  echo; echo "== 1. bare =="
  podman run --rm --entrypoint true "$IMAGE" && echo OK
  echo; echo "== 2. + keep-id =="
  podman run --rm --entrypoint true --userns=keep-id "$IMAGE" && echo OK
  echo; echo "== 3. + keep-id:uid=1000,gid=1000 =="
  podman run --rm --entrypoint true --userns=keep-id:uid=1000,gid=1000 "$IMAGE" && echo OK
  echo; echo "== 4. + caps =="
  podman run --rm --entrypoint true --userns=keep-id:uid=1000,gid=1000 --cap-add NET_ADMIN --cap-add NET_RAW "$IMAGE" && echo OK
  echo; echo "== 5. + volumes =="
  podman run --rm --entrypoint true --userns=keep-id:uid=1000,gid=1000 --cap-add NET_ADMIN --cap-add NET_RAW \
    -v "$PWD":/workspace -v cocoon-ai-node-modules:/workspace/node_modules -v cocoon-ai-claude-config:/home/node/.claude "$IMAGE" && echo OK
  echo; echo "== debug log of the full flag set =="
  podman --log-level=debug run --rm --entrypoint true --userns=keep-id:uid=1000,gid=1000 --cap-add NET_ADMIN --cap-add NET_RAW \
    -v "$PWD":/workspace -v cocoon-ai-node-modules:/workspace/node_modules -v cocoon-ai-claude-config:/home/node/.claude "$IMAGE" 2>&1 \
    | grep -iE 'error|crun|runc|conmon|denied|permitted' | tail -20
} 2>&1 | tee /tmp/podman-debug.txt
echo; echo "saved to /tmp/podman-debug.txt"
