# cocoon-ai

Component and utility library for the [Cocoon](https://github.com/theCocoonStudio) studio website — a dual-engine React 19 / react-three-fiber app. Developed with Claude (Claude Code) and consumed by the main Cocoon site as a dependency.

Built with Vite in library mode. Plain JavaScript, ESM output. Every runtime dependency the site provides (`react`, `react-dom`, `three`, `@react-three/*`, `maath`, `tunnel-rat`, `@pmndrs/assets`) is a peer dependency and is never bundled.

```bash
npm run build         # emit dist/index.js (minified, sourcemaps carry source)
npm run dev           # rebuild on change
npm test              # vitest, once (npm run test:watch to keep it running)
npm run lint          # eslint
npm run format        # prettier
```

Components are general React 19: nothing in `src/` assumes a bundler. Anything a bundler would normally supply (env values, asset URLs, lazy imports) arrives as an input. The build stamps `"use client"` onto `dist/index.js` so a Next consumer gets a client boundary and a Vite consumer ignores it.

## Layout

```
src/
  index.js                    public entry; one named export per component
  <Component>/
    index.jsx                 the component
    <Component>.spec.md       the spec it was built from
    <Component>.resolved.md   what was derived from the spec: contracts, defaults, notes, gaps
    <Component>.test.jsx      tests, named by spec id
    *.js                      helpers used only by this component
  utils/                      reusable, React-free functions with their own tests; not exported unless something outside needs them
docs/
  <Component>.md              API doc: props, handle, dispose rules, limits
.claude/skills/               the skill that builds components from specs
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

- nothing of mine on the box except a clone of this repo and the GitHub App's private key
- Claude Code runs only inside the `.devcontainer/` sandbox, started with `.devcontainer/run.sh claude`
- non-sudo login user that only runs the container; a separate account, used only for maintenance, is the sole sudoer. No Docker on the box: the container runs under rootless podman, so there is no privileged daemon in the path and container root is an unprivileged subordinate uid on the host
- reached from my Mac over ssh, or remote desktop via the Windows App: directly on the LAN at home, and from outside through Tailscale, which terminates on the NAS and routes to the box locally. The box itself runs no Tailscale. Wake-on-LAN from an always-on LAN device
- `main` ruleset: PRs only, one approving review, no force-push, no bypass. Authors can't approve their own PRs, so Claude reviews mine and I review Claude's.

### Auth: a GitHub App, not a PAT

Claude acts on GitHub as its own bot user, `cocoon-claude[bot]`, through a GitHub App installed on this org for `cocoon-ai` and `cocoon-ai-records` only. The App's private key stays on the box; it is never mounted into the container.

`run.sh` signs a short-lived JWT with the key, exchanges it for a 1-hour installation token, and passes only that token into the container as `GH_TOKEN`. A session that outlives the token loses push/PR access until `run.sh` is started again. Nothing is written to disk inside the sandbox.

Commits, branches, and PRs made by Claude are attributed to the bot, so I can review and approve them as a different user, which the old PAT on my own account never allowed. `COCOON_NO_GITHUB=1` starts a session with no credential at all.

Neither layer limits what Claude can do to the code: it has the full repo, the full toolchain, and GitHub. What it doesn't have is anything else.

### A note on trust

Security here isn't only about trusting the sandbox or the OS. It's about knowing they're not foolproof and can be broken. Containers escape, VMs have bugs, and an agent reading untrusted content (packages, web pages) can be steered. The layers above exist so that when one fails, the next one limits what's reachable: a scoped token instead of an account, a mounted repo instead of a home directory, a PR instead of a push. Review is the last layer, and it's the one that isn't automated.

The security incident log and per-session transcript exports live in the private [`cocoon-ai-records`](https://github.com/theCocoonStudio/cocoon-ai-records) repo.

These points shouldn't need be said. They should be salient. But they're often not, even at the Enterprise level, let alone a home office.
