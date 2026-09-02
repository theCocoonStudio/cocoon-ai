# cocoon-ai

Component and utility library for the [Cocoon](https://github.com/theCocoonStudio) studio website — a dual-engine React 19 / react-three-fiber app. Developed with Claude (Claude Code) and consumed by the main Cocoon site as a dependency.

Built with Vite in library mode. Plain JavaScript, ESM output. Every runtime dependency the site provides (`react`, `react-dom`, `three`, `@react-three/*`, `maath`, `tunnel-rat`, `@pmndrs/assets`) is a peer dependency and is never bundled.

```bash
npm run build         # emit dist/index.js (minified, sourcemaps carry source)
npm run dev           # rebuild on change
npm run lint          # eslint
npm run format        # prettier
```

## How Claude and I work together

Claude does most of the typing; I direct, review, and merge. The rule is that Claude never runs with more access than the task needs, and every change lands through git so it can be read before it counts.

Two layers, used together:

### Good (temporary): container on my Mac

Claude Code runs inside the sandbox defined in [`.devcontainer/`](.devcontainer/), via Colima (open source, no app, only this repo mounted into the VM):

- non-root user, only `/workspace` (this repo) visible
- outbound network default-deny; allowlist is GitHub, the npm registry, and the Anthropic API/login hosts
- no host secrets mounted; GitHub access is a fine-grained PAT scoped to this one repo, passed in the environment for the session only
- `node_modules` and Claude's own state live in Docker volumes, not in the repo

This was the bridge while the dedicated machine came online. Same sandbox, weaker host.

### Best: dedicated hardware, same container

A separate Debian machine that exists only to run the agent. The container above runs there too; the box is the outer wall, the container is the inner one.

- nothing of mine on the box except a clone of this repo and one scoped token
- Claude Code runs only inside the `.devcontainer/` sandbox, started with `.devcontainer/run.sh claude`
- non-sudo login user; Docker is the only privileged thing installed
- reached from my Mac over Tailscale with ACLs (only my Mac can connect), Wake-on-LAN from an always-on LAN device, remote desktop via the Windows App
- branch protection on `main`: PRs only, I am the reviewer

Neither layer limits what Claude can do to the code: it has the full repo, the full toolchain, and GitHub. What it doesn't have is anything else.

### A note on trust

Security here isn't only about trusting the sandbox or the OS. It's about knowing they're not foolproof and can be broken. Containers escape, VMs have bugs, and an agent reading untrusted content (packages, web pages) can be steered. The layers above exist so that when one fails, the next one limits what's reachable: a scoped token instead of an account, a mounted repo instead of a home directory, a PR instead of a push. Review is the last layer, and it's the one that isn't automated.

The security incident log and per-session transcript exports live in the private [`cocoon-ai-records`](https://github.com/theCocoonStudio/cocoon-ai-records) repo.

These points shouldn't need be said. They should be salient. But they're often not, even at the Enterprise level, let alone a home office.
