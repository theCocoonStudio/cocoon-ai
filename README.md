# cocoon-ai

Component and utility library for the [Cocoon](https://github.com/theCocoonStudio) studio website — a dual-engine React 19 / react-three-fiber app. Developed with Claude (Claude Code) and consumed by the main Cocoon site as a dependency.

Built with Vite in library mode. Plain JavaScript, ESM output. Peer dependencies are the packages the site must share one instance of and this library imports: `react`, `react-dom` and `three`, never bundled. A package becomes a peer the day a component imports it (`@react-three/fiber` will, when an r3f component lands) and not before; everything only the build or the tests need is a devDependency. Versions track the site's own `package.json`.

## Scripts

Every `package.json` script, what it does, and where to read more.

| script                                   | does                                                                                                                   | more                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `npm run build`                          | emit `dist/index.js`, minified, sourcemaps carrying source                                                             |                                                        |
| `npm run dev`                            | the build, rerun on change                                                                                             |                                                        |
| `npm test`                               | vitest, once                                                                                                           |                                                        |
| `npm run test:watch`                     | vitest, kept running                                                                                                   |                                                        |
| `npm run lint`, `npm run lint:fix`       | eslint, report or fix                                                                                                  |                                                        |
| `npm run knip`                           | unused files, exports and dependencies across the package; `knip.json` names the script entries                        |                                                        |
| `npm run check`                          | everything a PR must pass, in order: lint, format check, knip, tests, build                                            |                                                        |
| `npm run format`, `npm run format:check` | prettier, write or check                                                                                               |                                                        |
| `npm run assets`                         | rebuild every shipped asset: the icon set, then the logo                                                               | [assets/README.md](assets/README.md)                   |
| `npm run assets:icons`                   | the 26 icon SVGs and their contact sheet, with the five build guards                                                   | [assets/icons/README.md](assets/icons/README.md)       |
| `npm run assets:logo`                    | the mark, favicons, wordmark, lockups and PNG previews; refuses if the four plain icons or the spec's tier table drift | [assets/logo/README.md](assets/logo/README.md)         |
| `npm run export:logo -- [params]`        | the mark or lockup at chosen scene values, plus a sheet of neighbours around each value                                | [docs/export-logo.md](docs/export-logo.md)             |
| `npm run export:logo-group -- [props]`   | the logo mesh rendered by three's WebGLRenderer, screenshot by a headless Chromium, every prop value printed beside it | [docs/export-logo-group.md](docs/export-logo-group.md) |

Components are general React 19: nothing in `src/` assumes a bundler. Anything a bundler would normally supply (env values, asset URLs, lazy imports) arrives as an input. The build stamps `"use client"` onto `dist/index.js` so a Next consumer gets a client boundary and a Vite consumer ignores it.

## Configuration

`cocoon.config.js` at the root is the one place a design default is stated: the scene, the ink and the two cuts, the mark's apex and fillet, the wordmark's Saira instance, the lockup's sizes, air tiers and defaults, the favicon tile, the icon stroke, the logo mesh's defaults and the export camera. The scene module, the haze engine, the asset builds, the export scripts and the components import it; no file restates a number, and `src/utils/config.test.js` checks that each reader takes its value from there.

To change a default: edit the file, `npm run assets`, `npm test`, and look at the previews. A scene change moves the four plain icon files, which the logo build refuses to overwrite; delete them first, as `assets/logo/README.md` says. The file is committed, since a design default belongs to the repo and not to a machine.

## What checks what

Three layers, each with its own scope, so a rule lives in one place.

- **The build, `npm run check`.** Everything a script can decide yes or no from the repository alone: lint, format, knip, the tests, the bundle. That includes the repo's structure, as tests in `src/structure.test.js`: every script has a README row, every README link resolves, every component folder has its four files and its doc and its export, every prop a component declares is named in its doc, every config value is read by something. A failure names the file and line it came from and the file the fix goes in. Nothing here needs judgment; if a check does, it is not in the build.
- **The review, `.claude/skills/pr-review`.** Everything that needs judgment: whether the change matches its claim, whether a test tests the right thing, whether a doc is true rather than present, whether a name means the same in every place, and the attack beyond the checklist. The review's first floor item is that the build passes, so it never repeats the build's work.
- **CI.** Runs the build on every PR and on `main`, so "the check passes" is a status on the PR rather than a claim in its body. Made a required status in the ruleset, it binds. The workflow file is added once the GitHub App can write workflows.

There is no pre-commit hook. The check is one command and the review requires it; a hook would be a second copy of the same rules on two machines. If a red commit ever lands, that is the day to add one, and it would run only the fast subset: format, lint, knip.

## Consuming the package

What reaches the browser is decided twice: this build sets what is in `dist/index.js` (one ESM module, minified, `sideEffects: false`, every module-scope call marked `/* @__PURE__ */`), and the site's bundler decides how much of that file survives into a chunk. Turbopack, webpack and Vite all read both signals. Nothing on the consumer's side needs configuring; the import shape is what matters.

**Static, named.** The form for anything on first paint, the nav logo included. Several names on one line are fine; what matters is that they are named.

```js
import { CocoonIcon, CocoonLogoGroup } from 'cocoon-ai'
```

**Namespace.** Bundlers track member access on a namespace, so this still shakes, but it is the form that breaks first. Prefer the named list.

```js
import * as cocoon from 'cocoon-ai' // cocoon.CocoonIcon
```

**Dynamic `import()`.** Once the module goes through a promise, the bundler cannot see which export the callback reads, so the lazy chunk carries all of cocoon-ai. Rollup and rolldown recognise the narrow case where the export is destructured directly in the `.then` parameter; do not count on it elsewhere.

```js
const { MorphTargetsGroup } = await import('cocoon-ai') // whole package in the chunk
```

**`React.lazy` and `next/dynamic`.** Same rule, same fix: make the lazy boundary a one-line module of your own that re-exports one name. The import from cocoon-ai is static and named again, so the chunk holds that component and what it reaches.

```js
// components/MorphTargetsGroup.js
export { MorphTargetsGroup as default } from 'cocoon-ai'
```

```jsx
import { lazy } from 'react'
const MorphTargetsGroup = lazy(
  () => import('./components/MorphTargetsGroup.js'),
)

import dynamic from 'next/dynamic'
const MorphTargetsGroup = dynamic(
  () => import('./components/MorphTargetsGroup.js'),
  { ssr: false },
)
```

Lazy is for what sits below the fold. The nav logo is on every page's first paint, so deferring it adds a request and a frame without the logo.

Measured with rolldown, react and three external, what a consumer pulls from `dist/index.js`: `VERSION` alone 469 bytes, `CocoonIcon` alone 13 kB, `CocoonLogoGroup` alone 37 kB, everything 60 kB, minified before gzip.

Two things the package cannot change. The React Compiler does not touch `node_modules`, so these components are not auto-memoised the way the site's own are; the heavy work is under explicit `useMemo` keyed on values instead. And the weight in any scene is `three`, not this package: `WebGLRenderer` alone keeps about 490 kB minified, 122 kB gzipped, of it, and a mesh in the nav brings that to every route. A site whose Canvas already mounts on every page has paid it.

## Layout

```
cocoon.config.js              every design default, read by src/, assets/ and the scripts; see Configuration
src/
  index.js                    public entry; one named export per component
  <Component>/
    index.jsx                 the component
    <Component>.spec.md       the spec it was built from
    <Component>.resolved.md   what was derived from the spec: contracts, defaults, notes, gaps
    <Component>.test.jsx      tests, named by spec id
    *.*                       helpers and assets used only by this component
  utils/                      reusable, React-free functions with their own tests; not exported unless something outside needs them
  structure.test.js           the repo's structure as tests; see What checks what
docs/
  <Component>.md              API doc: props, handle, dispose rules, limits
  utils/<util>.md             API doc for a util worth reading about on its own; a folder, so a util and a component of the same name never collide on a case-insensitive disk
  export-logo.md              the export:logo script: grammar, every parameter, output
  export-logo-group.md        the export:logo-group script: the logo mesh rendered by three and screenshot, and the camera to show it with
assets/                       the studio's marks, produced by the scripts beside them; see assets/README.md
  lib/                        the four-plane engine shared by the icons and the logo
  icons/                      the UI icon set: shapes.js in, 26 SVGs and a contact sheet out
  logo/                       the mark, favicons, wordmark and lockups
.claude/skills/               the skills: react-component-from-spec builds a component from its spec; pr-review is how a PR is reviewed here, by either author
```

## To reproduce

Some files are local to a machine and never committed, like an env file. Recreate them after a fresh clone:

- `.claude/settings.local.json` — per-machine Claude Code permissions. The committed `.claude/settings.json` carries the shared config (model, hooks); this file adds the read paths Claude needs inside the container without a prompt each time:

  ```json
  {
    "permissions": {
      "allow": ["Read(//proc/1/**)", "Read(//home/node/**)"]
    }
  }
  ```

  `/proc/1` is the container's PID 1, which the token-expiry hook reads for the start time. `/home/node` holds Claude's memory and session logs.

This list is not complete yet; add to it as more local files turn up.

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

The security incident log and per-session transcript exports live in the private [`cocoon-ai-records`](https://github.com/theCocoonStudio/cocoon-ai-records) repo. Inside the sandbox it is cloned into a named volume at `/home/node/cocoon-ai-records` on first start, so the clone survives container rebuilds.

These points shouldn't need be said. They should be salient. But they're often not, even at the Enterprise level, let alone a home office.
