# cocoon-ai

Component and utility library for the [Cocoon](https://github.com/theCocoonStudio) studio website — a dual-engine React 19 / react-three-fiber app. Developed with Claude (Claude Code) and consumed by the main Cocoon site as a dependency.

Built with Vite in library mode. Plain JavaScript, ESM output. Peer dependencies are the packages the site must share one instance of and this library imports: `react`, `react-dom` and `three`, never bundled. A package becomes a peer the day a component imports it (`@react-three/fiber` will, when an r3f component lands) and not before; everything only the build or the tests need is a devDependency. Versions track the site's own `package.json`.

## Scripts

Every `package.json` script, what it does, and where to read more.

| script                                   | does                                                                                                                                                               | more                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `npm run build`                          | emit `dist/index.js`, minified, sourcemaps carrying source                                                                                                         |                                                        |
| `npm run dev`                            | the build, rerun on change                                                                                                                                         |                                                        |
| `npm test`                               | vitest, once                                                                                                                                                       |                                                        |
| `npm run test:watch`                     | vitest, kept running                                                                                                                                               |                                                        |
| `npm run lint`, `npm run lint:fix`       | eslint, report or fix                                                                                                                                              |                                                        |
| `npm run lint:sh`                        | shellcheck over the hooks with `.shellcheckrc`; the same linter runs on every Bash command before it runs (the hook)                                               |                                                        |
| `npm run knip`                           | unused files, exports and dependencies across the package; `knip.json` names the script entries                                                                    |                                                        |
| `npm run check`                          | everything a PR must pass, in order: lint, shell lint, format check, knip, tests, build                                                                            |                                                        |
| `npm run check:ci`                       | the same check with the tests on two workers, the runner's parallelism; the dry run before every PR                                                                |                                                        |
| `npm run test:ci`                        | vitest, once, two workers: what CI's two cores see                                                                                                                 |                                                        |
| `npm run format`, `npm run format:check` | prettier, write or check                                                                                                                                           |                                                        |
| `npm run assets`                         | rebuild every shipped asset: the icon set, then the logo                                                                                                           | [assets/README.md](assets/README.md)                   |
| `npm run assets:icons`                   | the 26 icon SVGs and their contact sheet, with the five build guards                                                                                               | [assets/icons/README.md](assets/icons/README.md)       |
| `npm run assets:logo`                    | the mark, favicons, wordmark, lockups and PNG previews; refuses if the four plain icons or the spec's tier table drift                                             | [assets/logo/README.md](assets/logo/README.md)         |
| `npm run export:logo -- [params]`        | the mark or lockup at chosen scene values, plus a sheet of neighbours around each value                                                                            | [docs/export-logo.md](docs/export-logo.md)             |
| `npm run export:logo-group -- [props]`   | the logo mesh rendered by three's WebGLRenderer, screenshot by a headless Chromium, every prop value printed beside it                                             | [docs/export-logo-group.md](docs/export-logo-group.md) |
| `npm run verify:repo -- <owner>/<repo>`  | a repository's settings, Apps, ruleset and files against the setup page, one line per fact, through `gh api`                                                       | [docs/new-repository.md](docs/new-repository.md)       |
| `npm run manifest`                       | rewrite `src/manifest.js`, the demos' manifest, from the component folders and the docs' front matter; `src/manifest.test.js` fails when the committed file drifts | [src/manifest.spec.md](src/manifest.spec.md)           |

Components are general React 19: nothing in `src/` assumes a bundler. Anything a bundler would normally supply (env values, asset URLs, lazy imports) arrives as an input. The build stamps `"use client"` onto `dist/index.js` so a Next consumer gets a client boundary and a Vite consumer ignores it.

## Configuration

`cocoon.config.js` at the root is the one place a design default is stated: the scene, the ink and the two cuts, the mark's apex and fillet, the wordmark's Saira instance, the lockup's sizes, air tiers and defaults, the favicon tile, the icon stroke, the logo mesh's defaults and the export camera. The scene module, the haze engine, the asset builds, the export scripts and the components import it; no file restates a number, and `src/utils/config.test.js` checks that each reader takes its value from there.

To change a default: edit the file, `npm run assets`, `npm test`, and look at the previews. A scene change moves the four plain icon files, which the logo build refuses to overwrite; delete them first, as `assets/logo/README.md` says. The file is committed, since a design default belongs to the repo and not to a machine.

## What checks what

Three layers, each with its own scope, so a rule lives in one place.

- **The build, `npm run check`.** Everything a script can decide yes or no from the repository alone: lint, format, knip, the tests, the bundle. That includes the repo's structure, as tests in `src/structure.test.js`: every script has a README row, every README link resolves, every component folder has its four files and its doc and its export, every prop a component declares is named in its doc, every component doc opens with the front matter the manifest reads and its body is CommonMark with no raw HTML outside code and no image that is not beside it, every config value is read by something; and in `src/manifest.test.js`, which imports the module, that the committed manifest is what the generator writes and every entry's files exist. A failure names the file and line it came from and the file the fix goes in. Nothing here needs judgment; if a check does, it is not in the build.
- **The review, `.claude/skills/pr-review`.** Everything that needs judgment: whether the change matches its claim, whether a test tests the right thing, whether a doc is true rather than present, whether a name means the same in every place, and the attack beyond the checklist. The review's first floor item is that the build passes, so it never repeats the build's work.
- **The dry run, `npm run check:ci`.** The same check with the tests on two workers, which is what GitHub's runner has. Run before every PR, on Linux at least: on 2026-10-05 the browser tests passed here on twelve cores and timed out on the runner, where four Chromium launches at once took longer than the launcher's default. Timeouts in the harness are sized for the slowest runner seen, with the number and the date beside them, so a faster runner only makes them more conservative.
- **CI.** Runs the build on every PR and on `main`, so "the check passes" is a status on the PR rather than a claim in its body. Made a required status in the ruleset, it binds. Two more checks guard what the build cannot see: `policy`, the job of `.github/workflows/reviewer-policy.yml`, who may approve whose PR, by its exit code (it posted a `reviewer-policy` status until 2026-10-18, which any workflow with `statuses: write` could forge), and `dependency-check`, what a lockfile change brings in: GitHub's dependency review, registry signatures and provenance, and the repo's own reader `scripts/lockfile-check.mjs`, which refuses install scripts, releases under seven days old, publisher changes, tarballs off the registry, and an integrity that changed under the same version or is not the registry's for that version, with reviewed exceptions in `.github/dependency-allow.json`, each naming the one rule it excuses (integrity has none); the registry's answer is validated before it is judged.

There is no pre-commit hook. The check is one command and the review requires it; a hook would be a second copy of the same rules on two machines. If a red commit ever lands, that is the day to add one, and it would run only the fast subset: format, lint, knip.

- **The shell.** Every script passes ShellCheck with [`.shellcheckrc`](.shellcheckrc), each enabled check a class of mistake we made (`npm run lint:sh`, in the check), and every Bash command the agent runs goes through the same linter first: `.claude/hooks/lint-bash.sh`, a PreToolUse hook that blocks at warning or above and hands the findings to the agent before anything runs (Izzy, 2026-10-11: "we never write unlinted code"; the guardrail's catch of an unguarded `rm -rf` is the class it started with). Without shellcheck in the image the hook allows and the session-start hook says so.

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

**The demos entry.** `cocoon-ai/demos` is a second bundle, so a site that imports no demo carries none. `demos` is the manifest, one frozen entry per demo with the doc's front matter as data, the component and the demo as direct imports, the settings schema, the scene flag and the effects; a page lists or routes from it, and a route that wants one demo imports it by name from the same entry. The docs ship in the package under `docs/`, CommonMark with front matter, for the site to render with a renderer of its own. A demo takes the site's tunnel when its entry says `scene`, the site's styling through the wrapper's class, style and theme props, a `loader` element shown until its scene has compiled, and `onReady`; its `ref` is a handle with `root`, `materials` and `compile()`. The whole contract, with what a change to it means for the version, is `src/manifest.spec.md`.

```js
import { demos, FluidTextureDemo } from 'cocoon-ai/demos'
demos[0].name // 'useFluidTexture'; .title, .summary, .doc, .scene, .schema, .demo
```

Measured with rolldown, react and three external, what a consumer pulls from `dist/index.js`: `VERSION` alone 469 bytes, `CocoonIcon` alone 13 kB, `CocoonLogoGroup` alone 37 kB, everything 60 kB, minified before gzip.

Two things the package cannot change. The React Compiler does not touch `node_modules`, so these components are not auto-memoised the way the site's own are; the heavy work is under explicit `useMemo` keyed on values instead. And the weight in any scene is `three`, not this package: `WebGLRenderer` alone keeps about 490 kB minified, 122 kB gzipped, of it, and a mesh in the nav brings that to every route. A site whose Canvas already mounts on every page has paid it.

## Layout

```
cocoon.config.js              every design default, read by src/, assets/ and the scripts; see Configuration
src/
  index.js                    public entry; one named export per component
  demos.js                    the demos entry, `cocoon-ai/demos`: `demos`, the manifest; Demo, useSettings, EFFECTS; each demo by name
  manifest.js                 generated by `npm run manifest`, committed: one entry per demo (name, title, summary, since, credits, tags, doc, scene, component, demo, schema, effects)
  manifest.spec.md            the consumer interface: the manifest, the docs, the consumer's contract, loading, the fit test, versioning
  manifest.resolved.md        what the run settled: contracts, the defaults taken, notes, gaps
  manifest.test.js            the manifest against the files, the drift check, the size budgets
  manifest.browser-entry.jsx  the fit test's page: the consumer's shape with every entry rendered through its demo
  manifest.browser.test.js    the fit test: every entry mounts, a scene demo reports ready, the sidebar follows the schema, the ready budget
  <Component>/
    index.jsx                 the component
    <Component>.spec.md       the spec it was built from
    <Component>.resolved.md   what was derived from the spec: contracts, defaults, notes, gaps
    <Component>.test.jsx      tests, named by spec id
    <Component>.demo.jsx      the demo, where one exists: the scene under the site's conditions with its settings; exports demo, schema, scene, effects for the manifest
    *.*                       helpers and assets used only by this component
  utils/                      reusable, React-free functions with their own tests; not exported unless something outside needs them
  test/                       helpers for tests, not shipped: browser.js bundles a page and drives a headless Chromium so shader output can be read as pixels
  structure.test.js           the repo's structure as tests; see What checks what
docs/
  <Component>.md              API doc: props, handle, dispose rules, limits; opens with the front matter the manifest reads (title, summary, credits, since, tags); CommonMark only, shipped in the package
  utils/<util>.md             API doc for a util worth reading about on its own; a folder, so a util and a component of the same name never collide on a case-insensitive disk
  export-logo.md              the export:logo script: grammar, every parameter, output
  export-logo-group.md        the export:logo-group script: the logo mesh rendered by three and screenshot, and the camera to show it with
scripts/
  lockfile-check.mjs          the dependency reader CI runs on a lockfile change; see What checks what
  lockfile-check.test.mjs     its tests: the change list and the integrity rules, on fixture lockfiles
  manifest.mjs                the manifest generator; see src/manifest.spec.md
  manifest.test.mjs           its tests: the front matter reader's refusals, discovery, the generated text, on a fixture repo
assets/                       the studio's marks, produced by the scripts beside them; see assets/README.md
  lib/                        the four-plane engine shared by the icons and the logo
  icons/                      the UI icon set: shapes.js in, 26 SVGs and a contact sheet out
  logo/                       the mark, favicons, wordmark and lockups
.claude/skills/               the skills: react-component-from-spec builds a component from its spec; pr-review is how a PR is reviewed here, by either author; walkthrough is how an author walks the reviewer through one, a screen at a time; demo builds a component's demo for the site
.claude/agents/               Claude's direct reports (Izzy, 2026-10-08): Methuselah (the verifier) reads and reports with evidence, Gargamel (the builder) writes code and tests to a spec, Buridan (the choice finder, 2026-10-09) lists every choice in one artifact that nothing forces; all without network or executor by their tool lists (no Bash, PowerShell, Monitor, WebFetch, WebSearch, Skill, ToolSearch, Agent, no MCP), fresh every run, the record as their memory; Claude runs what they write and verifies what they report; used on short tasks as the dialectic Claude prompts, each round a brief with a chosen stance and a chosen blindness, the vantage made by saturating one artifact, their context at prompt time a proper subset of Claude's (Izzy, 2026-10-09; first run: the two rounds on cocoon-relations #6)
```

## To reproduce

Some files are local to a machine and never committed, like an env file. Recreate them after a fresh clone:

- `.claude/settings.local.json` — per-machine Claude Code permissions. The committed `.claude/settings.json` carries the shared config (model, hooks, and `idleCompaction` false since 2026-10-17: from Claude Code 2.1.299 a conversation over 200K tokens left idle about 54 minutes is compacted by itself, and the owner's rule is that a compaction is announced, so the agent's context is compacted only when the owner or the agent says so); this file adds the read paths Claude needs inside the container without a prompt each time:

  ```json
  {
    "permissions": {
      "allow": ["Read(//proc/1/**)", "Read(//home/node/**)"]
    }
  }
  ```

  `/proc/1` is the container's PID 1, which the token-expiry hook reads for the start time. `/home/node` holds Claude's memory and session logs.

This list is not complete yet; add to it as more local files turn up.

## The repositories

The work is seven repositories under [`theCocoonStudio`](https://github.com/theCocoonStudio), one job each; their descriptions and visibility as GitHub holds them (read 2026-10-16):

| Repository                                                                        | Description                                                       | Visibility |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| [`cocoon-ai`](https://github.com/theCocoonStudio/cocoon-ai)                       | library of components and utils developed with Claude (Fable 5.1) | public     |
| [`cocoon-agent-sandbox`](https://github.com/theCocoonStudio/cocoon-agent-sandbox) | security first sandbox with strict egress controls for agent CLIs | public     |
| [`cocoon-gateway`](https://github.com/theCocoonStudio/cocoon-gateway)             | cocoon's API gateway                                              | public     |
| [`cocoon-ml`](https://github.com/theCocoonStudio/cocoon-ml)                       | An ML implementation with Claude. WIP.                            | public     |
| [`cocoon-relations`](https://github.com/theCocoonStudio/cocoon-relations)         | Exploring from first principles                                   | public     |
| [`cocoon-copula`](https://github.com/theCocoonStudio/cocoon-copula)               | Connecting information systems                                    | public     |
| [`cocoon-ai-records`](https://github.com/theCocoonStudio/cocoon-ai-records)       | records for Claude and Izzy on their work in cocoon-ai            | private    |

The two agents reach each repository through the gateway with their own GitHub App (`cocoon-claude`, `cocoon-gemini`), and every public repository carries the same ruleset on `main`: one approval after the last push, code owners, linear history, rebase only, the checks `check` and `policy` required, no bypass (cocoon-ml carried `check` alone and no code-owner file until the audit of 2026-10-19 gave it both; its ruleset's two switches are the owner's). Every public repository also refuses a record of a session or a chat, and a project `.npmrc`, twice: in its structure check at the merge and by the `records-guard` workflow at the push. Standing up a new one, in the order the layers refuse, is [docs/new-repository.md](docs/new-repository.md).

## How Claude and I work together

With two agents on the repositories since 2026-10-16, the rules both follow are in the channel document of [cocoon-copula](https://github.com/theCocoonStudio/cocoon-copula), `docs/channel.md` there: the sessions, what a review is, the four questions before any push, and the routing of the owner's instructions through Claude, who sets the order of the agents' work and alone merges (the owner, 2026-10-17).

Claude does most of the typing; I direct, review, and merge. The rule is that Claude never runs with more access than the task needs, and every change lands through git so it can be read before it counts.

The sandbox the agents run in moved to its own repository on 2026-10-11, [cocoon-agent-sandbox](https://github.com/theCocoonStudio/cocoon-agent-sandbox): a sealed devcontainer for coding agents, default-deny egress, no credentials inside, one configuration file that lives on the host (`~/.config/cocoon/sandbox.json`, copied from that repository's example and edited by hand) and never in a repository; this repository holds none of it since the launcher on the box was reinstalled from there. That repository's README is the implementation doc: the box, the launcher that runs only a reviewed ref, the identity (a GitHub App per agent, the key never inside the container), the container, the wall and the hooks, every security line explained. The layers as they were first built here are in this file's history before 2026-10-11 and in the records. Sessions start with `cocoon claude` or `cocoon gemini` on the box. Next is the gateway, [cocoon-gateway](https://github.com/theCocoonStudio/cocoon-gateway): one host in the wall instead of a list, a policy table that refuses what the rules forbid, and no credential of any kind inside the container.

The hooks under `.claude/hooks/` stay here as this repository's session hooks: the token-expiry reminder, the version check of the CLIs the image carries against npm, and the Bash lint before every command.

### A note on trust

Security here isn't only about trusting the sandbox or the OS. It's about knowing they're not foolproof and can be broken. Containers escape, VMs have bugs, and an agent reading untrusted content (packages, web pages) can be steered. The layers above exist so that when one fails, the next one limits what's reachable: a scoped token instead of an account, a mounted repo instead of a home directory, a PR instead of a push. Review is the last layer, and it's the one that isn't automated.

The security incident log and per-session transcript exports live in the private [`cocoon-ai-records`](https://github.com/theCocoonStudio/cocoon-ai-records) repo. Inside the sandbox it is cloned to `/home/node/cocoon-ai-records` on a container's first start, beside `cocoon-ml` and `cocoon-relations`; none is a volume, so anything not pushed is gone with the container. The workspace itself is a volume, cloned once and kept.

These points shouldn't need be said. They should be salient. But they're often not, even at the Enterprise level, let alone a home office.
