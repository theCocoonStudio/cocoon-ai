# manifest spec: the consumer interface of the demos and the docs

Written 2026-10-18 from Izzy's answers in the spec REPL (records `claude/exports/2026-10-17-session-a739c7ab.md`, 2026-10-18 00:3x to 01:2x UTC; records PLAN.md "The website"), the items kept one by one. The interface between this library and a consumer such as the site: one manifest the library exports, the docs it ships, the contract a consumer may rely on, loading, the fit test, versioning. The manifest is a generated data module, not a component, so the sections below are the ones that apply; the amendments it makes to the Demo wrapper are in `src/Demo/Demo.spec.md` (its "Amendments" section of the same date) and the run applies the component skill there. Where a line is my call rather than an answer, it says so.

## meta

meta.kind: interface — a generated data module (manifest.js, written by a script) and the contracts of the sections below
meta.target: portable
meta.runtime: client
meta.file: src/manifest.js (generated; at the root of src, since a folder under src is a component folder to the structure test), src/demos.js (the entry, re-exporting it with Demo and useSettings)

## manifest

manifest.1: `cocoon-ai/demos` exports `demos`, one array, one entry per demo, in the order of the component folders' names
manifest.2: entry.name — the component's name, the folder's name
manifest.3: entry.summary — one sentence, from the doc's front matter (docs.2)
manifest.4: entry.scene — boolean, true when the demo sends a scene through the tunnel; a demo that uses the tunnel without declaring it is refused by the structure test
manifest.5: entry.component — the component, a direct import (loading.1), never lazy
manifest.6: entry.demo — the demo module, `<Name>.demo.jsx` as the demo skill defines it, a direct import
manifest.7: entry.schema — the settings schema the sidebar is built from, plain data, so a consumer renders the controls without the scene
manifest.8: entry.doc — the path of the doc's markdown relative to the package root (docs.1)
manifest.9: entry.credits — the authors as the record has them, from the doc's front matter, shared where shared
manifest.10: entry.tags — a short list of strings, from the front matter
manifest.11: entry.effects — the effects enum the demo accepts, in render order, or none
manifest.12: the manifest is generated at build time by a script from the component folders (library.script) and committed, so an entry cannot drift from its folder and a consumer reads a file and runs nothing
manifest.13: the structure test refuses: a `<Name>.demo.jsx` with no entry; an entry whose doc, demo or component does not exist; front matter missing a field the manifest reads; a demo using the tunnel with entry.scene false
manifest.14: the manifest carries nothing about styling, routing or layout; those are the consumer's (consumer.*)

## docs

docs.1: every component's doc stays at docs/<Name>.md and ships in the package: `docs` joins `files` in package.json
docs.2: each doc opens with front matter: title, summary, credits, since (the date it first shipped), tags; the front matter is data, the body prose
docs.3: the body is CommonMark with fenced code blocks and relative images; no raw HTML, no MDX, so one renderer on the consumer's side covers every doc and a doc never carries markup the consumer did not choose; a code block names its language
docs.4: images a doc references ship beside it under docs/ and are small; the exploration sheets are linked on GitHub, not shipped
docs.5: the structure test checks the front matter's fields, the absence of HTML, and that every relative image exists, beside its existing checks (every component has a doc; every declared prop is named in it)
docs.6: the manifest entry carries the front matter's fields parsed (manifest.3, 9, 10 and title, since), so a consumer renders a doc page's head from the entry and never parses front matter itself; entry.doc points at the body's file
docs.7: the consumer renders the body with any CommonMark renderer it chooses; the library ships no renderer and no styles for docs; the consumer's build copies the package's docs folder, images included, to where it serves static files
docs.8: a doc page and a demo page are the same entry read two ways; the consumer may put them on one page or two
docs.9: the "source" link beside a doc is the file's GitHub URL, built from the package's repository field and entry.doc
docs.10: across versions the library promises the fields and the body's grammar; a doc may change its words freely

## consumer

consumer.1: a demo is `<Demo>` wrapping the demo module; a consumer provides the tunnel when entry.scene is true (its scene goes through `tunnel.In` into the consumer's one Canvas, which the consumer owns; a demo never renders a Canvas) and a root ref it may traverse; when entry.scene is false there is no tunnel, no Canvas and no loader
consumer.2: styling is the consumer's entirely: demoContainerClass, settingContainerClass, their style props, and theme (Demo.spec props.4 to 8); the library ships no stylesheet and no look beyond layout
consumer.3: layout is the library's: the demo fills its container and never sets its own height; the sidebar toggled by openSettings or its button, bounded to half the container, scrolling on overflow; the stage shrinks and grows with it; the scene follows the container's rect at the camera's depth
consumer.4: settings come from entry.schema; the sidebar renders them, useSettings holds them, the demo reads them; a consumer may read the schema and render its own controls instead
consumer.5: effects are a prop from entry.effects, in render order
consumer.6: the contract is tested in the library by one page shaped like the consumer's (tests.1), so a change that breaks what the consumer relies on fails here first

## loading

loading.1: no lazy loading: entry.component and entry.demo are direct imports; the manifest's module is side-effect free so a consumer's route bundles what it imports; splitting by route is the consumer's, never the library's by laziness (Izzy: lazy loading jitters as a scene compiles)
loading.2: every page compiles on load behind a loader the consumer owns; the loader is global on the consumer's home page and inside the demo container elsewhere, when there is a scene
loading.3: readiness through both refs and props: a scene demo's handle exposes root, materials (every material the scene uses) and compile(), which compiles the demo's materials and initialises its targets with the Canvas's renderer and camera and returns a promise (Demo.spec amendments handle.*); the onReady prop fires when it resolves; the demo calls compile() on mount unless the consumer passes compile={false} and compiles by hand, the home page's case, in a batch over every entry's materials
loading.4: the Demo wrapper's `loader` prop is an element the consumer supplies, shown inside the demo container until ready, styled by the consumer; a consumer that shows a global loader ignores the slot and waits on every scene's onReady
loading.5: an asset a demo needs and the package does not ship is declared in its schema as a URL the consumer supplies, never a fetch the library chooses
loading.6: the main thread is kept: the compile is asynchronous where the renderer allows it, materials are shared and never permuted per instance, and a consumer's one Canvas outside its page tree keeps a compiled material compiled across routes; a worker with an OffscreenCanvas is the step named for when frame time, not compile time, becomes the problem (2026-10-18)

## tests

tests.1: the fit test: one browser test through the harness mounts a page shaped like the consumer's: one Canvas outside the page, a tunnel, a theme object, a loader element, and every manifest entry rendered through the Demo wrapper the way the consumer will; it asserts the manifest's fields are complete, a scene demo reports ready and its loader disappears, a markup demo renders with no Canvas touched, the sidebar renders from the schema and a control changes the scene, and each demo's compile time is within its recorded budget
tests.2: the site permission after the first run verifies the same page against the real consumer; a difference between the two is a finding

## versioning

versioning.1: the manifest's fields and the contracts of docs._, consumer._ and loading.* are the library's public interface from this spec on; a change to them is a major version by the package's rules, and the fit test is what proves a minor one did not break them
versioning.2: the consumer takes the package by file link now; npm publication is a later decision and changes nothing here

## out of scope

scope.1: the gallery and the articles are the consumer's data; nothing from the library
scope.2: the scene API's renderer (the JSON a scene is described in and the component that renders it into the consumer's one Canvas) is its own spec after this one
scope.3: the manifest's own page, a demo of the demos, is a later demo

## library

library.export: `demos` from src/demos.js (the `./demos` entry), beside `Demo` and `useSettings`
library.side-effects: none
library.helper: none
library.generated: src/manifest.js — written by the manifest script from the component folders and the docs' front matter; never hand-edited; committed
library.script: `npm run manifest` (scripts/manifest.js) — reads src/*/ for `<Name>.demo.jsx`, docs/<Name>.md for the front matter, writes src/manifest.js; `npm run check` fails when the committed file differs from what the script writes

## budget

budget.1: the manifest's module under 8 kB before compression, measured by the package's build in the tests
budget.2: each demo's chunk size and cold compile time on the harness's Chromium, recorded with the date at the first run as the budget each later run is held to; the numbers are filled at the run, not here
