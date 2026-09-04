---
name: react-component-from-spec
description: "Build a React 19 component and its tests from a structured spec input, validating the spec before writing any code. Covers DOM output with RTL and react-three-fiber output (frame loop, ref inputs, imperative handles, disposables, cross-renderer bridges) with @react-three/test-renderer."
---

# React Component From Spec

Build a React 19 component and its tests from a structured spec input. The spec input is written by the user; your job is to validate it, build exactly what it describes, and report anything you could not resolve.

The organizing principle for every judgment call in this skill:

**Default when a wrong guess fails loudly. Block when it fails silently.**

A wrong guess that breaks the build or a test costs one cycle. A wrong guess that renders a component invisible, drops an event, or lets a stale response win costs a debugging session weeks later. Everything below is an application of that one rule.

## Scope

- **React 19.** Later 19.x is fine — the API is additive. Do not apply this skill to React 18.
- **JavaScript with JSDoc.** No TypeScript, no `propTypes`. React 19 removed `propTypes` checking entirely and ignores it silently, so JSDoc plus tests is the whole enforcement story.
- **react-three-fiber 9 for anything rendered inside a `<Canvas>`.** The DOM rules apply unchanged to the DOM side — a site that runs two React renderers has plenty of markup, event handlers, and state on both sides of the canvas. The scene side adds four things the DOM model has no field for: a frame loop, inputs that arrive as refs and change without rendering, objects that must be disposed, and output that crosses into the other renderer. Each has its own spec section below.
- **Tests with React Testing Library for DOM output and `@react-three/test-renderer` for scene output and the frame loop.** Runner-agnostic.
- **Conformance to an existing codebase is out of scope.** Do not read neighboring components to infer house style. Everything that matters is in the spec input — most importantly the imports block, which resolves aliases and dependencies without any file reading.
- **Never edit the spec input.** Report; the user amends; re-run. The tempting resolution to most problems is to quietly weaken a requirement, which produces working code and a spec that no longer describes it.

## The run

1. Read the spec input.
2. **Pre-flight** — validate the spec input against the field model. Produce the report.
3. If nothing blocks, build the component and the tests.
4. Write the resolved spec — the input plus everything derived from it.
5. Verify — run the tests, check traceability both directions.
6. Report.

Pre-flight needs no code and catches most problems. Run it fully before writing anything.

---

## Spec input format

The spec input lives beside the component as `<Component>.spec.md`. Every line carries a stable id, because test names reference those ids and that is how completeness is checked.

Required sections must be present with an explicit `none` rather than omitted. Absence and "none" look identical otherwise, and every blank becomes a question you have to ask.

```markdown
# Button spec

## meta
meta.target: portable             # next | vite | portable — required; this repo builds portable components
meta.runtime: client              # client | server | shared
meta.file: Button.jsx

## imports
imports.1: import { useState } from 'react'
imports.2: import { cn } from '@/lib/cn'
imports.lazy.1: const Editor = lazy(() => import('./Editor'))

## props
props.1: label — string, required
props.2: variant — 'default' | 'danger', optional, default 'default'
props.3: onSelect — (id) => void, required, referentially stable
props.passthrough: yes → spread onto root <button>
props.ref: accepted → root DOM node    # root DOM node | root Object3D | handle (see handle.*) | none

## slots
slots.mechanism: children
slots.1: children — rendered inside the label span

## context
context.consumed: none
context.provided: none

## state
state.1: open — boolean, initial false
state.reset: none

## markup
markup.1: root <button type="button">, accessible name from `label`
markup.2: aria-expanded reflects `open`
markup.3: chevron <svg aria-hidden="true">
markup.4: children render inside <span class="label">

## states
states.default: markup.1–4
states.disabled: markup.1 with disabled; onSelect never fires
states.pending: none
states.empty: none
states.error: none

## callbacks
callbacks.1: onSelect — fires on click, payload `id`, after `open` toggles
callbacks.neg.1: does not fire while disabled

## effects
effects: none

## exits
exits.throws: never
exits.suspends: never
exits.handler-failures: none
```

**Id conventions.** `markup.4`, `states.empty`, `effects.1`, `callbacks.neg.1`. Ranges are written `markup.1–4`. Ids are the user's; never renumber or rename them.

### Scene sections

Required whenever `imports.*` pulls in `three`, `@react-three/*`, or `tunnel-rat`; omitted entirely otherwise. `library` is required for every component, because this repo is a package. A DOM-side component never carries `none` for six sections it has no use for.

```markdown
## refs                              # inputs read imperatively — a change never renders
refs.1: scroll — RefObject<number>, required, written by the page scroller before each frame, read by frame.1
refs.2: mesh — internal, RefObject<Mesh>, the root mesh, set by React on mount

## handle                            # what `ref` exposes when props.ref is `handle`
handle.1: frame — (state, delta) => void, this component's frame work, same signature as a useFrame callback
handle.2: reset — () => void, returns the ribbon to its rest pose
handle.3: dispose — () => void, releases every dispose.* object; idempotent; the component is inert afterwards

## frame
frame.mode: handle                   # internal | handle | tunnel | none — required
frame.args: none                     # internal only: useFrame's second argument, e.g. `priority 1`
frame.tunnel: none                   # tunnel only: the prop that carries the tunnel, e.g. `tunnel`
frame.1: reads refs.1, writes refs.2 position.y = scroll × amplitude, eased by delta
frame.2: writes material uniform uTime += delta
frame.writes-react: never            # never | what is set, under what condition, how often
frame.invalidate: not needed         # not needed (Canvas frameloop is always) | calls invalidate after frame.1–2
frame.sync.1: prop `size` → rebuild geometry (dispose.geometry); not read in the loop
frame.sync.2: prop `amplitude` → mirrored into a ref, read by frame.1

## dispose                           # every memory-holding object this component creates, keyed by name
dispose.geometry: BufferGeometry built in useMemo from `size` — on `size` change and on unmount
dispose.texture.noise: DataTexture built once in useMemo — on unmount
dispose.material: declared in JSX — fiber, on unmount
dispose.after: mesh.visible = false, frame.1–2 no-op   # what handle.dispose leaves behind; required when handle.dispose exists

## bridge                            # output that leaves this renderer
bridge: none

## library
library.export: named `Ribbon` from src/index.js
library.side-effects: none           # none | what runs at module scope and why it must
```

---

## Pre-flight checklist

Each row is answerable by reading the spec input alone.

| Check | Fails when |
|---|---|
| Required fields present | `meta.target`, `meta.runtime`, slots, or props missing entirely |
| Explicit `none` | A required section omitted rather than set to `none` |
| Every render state has markup | A state enumerated with nothing to render |
| Callbacks complete | A callback missing its trigger, payload, or ordering |
| Effects survive both gates | See "Effects" below |
| Dep-array props marked stable | An effect depends on a prop with no stability contract |
| Exits have boundary decisions | A throw or suspend with no owner named |
| Imports closed both ways | Something used but not declared, or declared but not used |
| Ownership consistent | A rendering decision needs data the chosen slot mechanism excludes |
| Markup lines are queryable | A markup line with no possible RTL assertion |
| Target syntax matches target | `import.meta.env` under Next, `"use client"` under Vite |
| Scene sections present | `three`, `@react-three/*`, or `tunnel-rat` is imported and `refs`, `handle`, `frame`, `dispose`, or `bridge` is missing |
| Frame mode decided | `frame.*` lines with no `frame.mode`; `handle` mode with no `handle.*` frame entry; `tunnel` mode with no `frame.tunnel` |
| Loop reads through refs | A `frame.*` line reads a prop or state that no `refs.*` or `frame.sync.*` line mirrors |
| Loop stays out of React | `frame.writes-react` missing, or a frame line that sets state without a `frame.writes-react` entry naming it |
| Positive priority owns rendering | `frame.args` with a priority above 0 and no frame line that renders |
| Invalidation decided | `frame.invalidate` missing |
| Disposal keyed | An object the component creates (`useMemo`, `new`, a render target) with no `dispose.<name>` line; a `dispose.*` line without its moment; a `frame.sync.*` rebuild with no `dispose.*` line; `handle.dispose` present with no `dispose.after` |
| Bridges have a far end | A `bridge.*` line that does not name where the content lands |
| Suspends match the assets | `useGLTF`, `useTexture`, `useFBX`, or `useLoader` imported with `exits.suspends: never` |
| Library export named | `library.export` missing |

---

## The report

Four classes. Batch them into one report — serial questions make the skill slower than writing the component by hand.

**BLOCK** — a wrong guess would fail silently. Write nothing, not even a partial file. A half-generated file looks like progress and isn't.

```
BLOCK
  states.loading is enumerated but has no markup.
  Guessing renders something plausible that nobody asked for and no test can justify.
```

**DEFAULT** — a wrong guess fails loudly, so take it and record it where the user will see it.

```
DEFAULTS TAKEN
  race: ignore-flag — effect-initiated, the given API takes no signal
  root: single element — required as the passthrough target by props.passthrough
```

**NOTE** — nothing is wrong, but it will bite later. Keep these to a handful or nobody reads them.

**SCHEMA GAP** — the spec input is fine; the field model has nowhere to put what the user is expressing. This is not their mistake, and it should not be crammed into a free-text field. Collecting these is how the field model gets revised.

```
SCHEMA GAP
  Requested: "scroll position survives a route change"
  No field expresses cross-instance persistence.
  Recorded in the output; not validated, not tested.
```

**Contradictions always BLOCK and are never resolved.** The characteristic failure is quiet resolution — adding an unrequested prop, switching slot mechanism, wrapping in a container — which yields code that works and a spec that has become fiction. Report the two conflicting fields in spec terms, offer options, pick none:

```
CONTRADICTION
  slots.mechanism: component reference
  markup.6: highlight wrapper on the active row
  The child constructs every element uniformly; "active" is caller state.
  Options: (a) render prop, (b) pass `active` down and let this component own the rule
```

Three detectors, all mechanical:

- **Ownership mismatch** — a decision is required from the side that does not hold the information.
- **Untestable required line** — a markup line with no RTL expression.
- **Perceivable output with no spec line** — the reverse traceability check.

**If more than about five things BLOCK, say the spec isn't ready** and give the five most structural ones. Rebuilding a spec through thirty chat questions is the worst available medium for it.

**Mid-write discovery gets the same treatment.** Some contradictions only appear three-quarters through. Stop and report. The urge to escape the corner with one extra prop is exactly what this rule exists to prevent.

---

## Building the component

### Module frame

Everything above the function is spec, not incidental.

- `"use client"` as the literal first line when the target is Next and the runtime is client. Under Vite it is inert — do not emit it. Under portable it is not written in source either: Vite 8 strips module directives from the lib bundle, so `vite.config.js` stamps it onto `dist/index.js` at build time (`build.rollupOptions.output.banner`), where a Next consumer sees it and a Vite consumer ignores it.
- Imports exactly as the spec input declares them. Static and analyzable: no `require`, no `eval`, no computed paths. Nothing gets added; a needed import that isn't declared is a BLOCK.
- Named exports over default. A default export gets renamed freely at each import site, which makes the component unsearchable.
- `lazy()` only at module scope. Created inside the component body it produces a new component type every render, remounting the subtree every time.
- **Nothing at module scope may touch `window` or `document`,** and any module-scope value is shared by every instance in the app for the life of the page. A `const cache = new Map()` above the function is a singleton, and under a bundler module scope may run during SSR or prerender where those globals don't exist.

### Inputs

Props are documented with a JSDoc `@typedef` once there are more than two or three — it's reusable and the name shows in editor tooltips. Optionality is syntax, not prose:

```js
/**
 * @typedef {object} ButtonProps
 * @property {string} label
 * @property {'default'|'danger'} [variant='default']
 * @property {(id: string) => void} onSelect
 */
```

Defaults live in the destructure, since React 19 removed `defaultProps` for function components and that is now the only mechanism:

```js
function Button({ label, variant = 'default', onSelect, ...rest }) {
```

Because nothing checks props at runtime or compile time, invalid states have to be prevented by design rather than rejected by declaration:

- One `variant="danger"` over three booleans that can contradict each other.
- Name booleans positively and bare — `open`, `disabled`, `checked` — matching the platform. An `isDisabled` prop next to the DOM's own `disabled` is a collision waiting to happen, especially with passthrough on.
- Handler props are `onX`; the implementation inside is `handleX`.
- A handler named like a DOM event carries the event. To hand back a value instead, rename it — `onValueChange(value)`.

**`ref` is a plain prop in React 19.** No `forwardRef`. Ref callbacks can return a cleanup function, which is usually a better way to attach and detach an observer to a node than an effect.

**Context consumed is an input that never appears at the call site.** List every one. When a provider is required, throw with a message naming the provider rather than returning `undefined` and crashing three lines later.

**Slots.** Choose by the direction data flows:

| Situation | Mechanism |
|---|---|
| Caller supplies content | `children` or element props |
| Data flows child → caller | render prop |
| Caller swaps an implementation, child owns the data | component reference |
| A family of related parts | compound components |

An element prop gets a fresh identity every parent render, so it can never be an effect dependency. A component reference is stable, but the child then decides what prop name the data arrives under — a coupling that appears in neither file's prop list.

**Passed props always win over injected ones**, unless the spec says otherwise.

### Outputs

The markup comes from the spec input. Do not invent structure, and do not improve on what's written.

Semantics are the output, not a layer on it — a native `<button>` rather than `<div role="button">`, because the roles, labels, and focus order are what the component actually produces.

Two structural decisions with consequences elsewhere: whether the root is a single element or a fragment, and what the root is. A fragment root has no obvious default ref target and nowhere for `className` passthrough to land, which silently invalidates `props.passthrough`.

**Render states are where specs fail most often.** Build every state the spec enumerates. `empty` and `not yet asked` are different states; a transition that keeps the previous UI on screen while pending is a different output from a spinner replacing it.

**Keys are the one contract that points downward.** This component's identity is assigned by its parent, but its children's identity is assigned by it. A wrong key remounts subtrees that had every right to persist.

**Output that escapes the subtree** is real output and can collide with siblings: portals, and React 19's metadata hoisting — *"When React renders this component, it will see the `<title>` `<link>` and `<meta>` tags, and automatically hoist them to the `<head>` section of document."* Two components each rendering a `<title>` is last-one-wins with no error.

### Exit channels

A render can return, throw, or suspend. All three are specified.

- **Throw** — the nearest error boundary catches it. With no boundary, React unmounts the whole tree and the user gets a blank screen. Prefer returning an error state over throwing when the spec allows.
- **Suspend** — the nearest Suspense boundary shows its fallback; a rejected promise reaches the nearest error boundary. Asset hooks — `useGLTF`, `useTexture`, `useFBX`, anything built on `useLoader` — suspend on first load, so a component that imports one cannot declare `exits.suspends: never`, and the boundary owner question has to be answered. `use` is not a hook and may be called conditionally, but it **cannot be called inside try/catch** — suspension is implemented as a throw, so catching it would swallow React's own control flow. Per-read error handling therefore isn't available: error granularity equals boundary granularity equals component granularity. The escape hatch is to catch at promise creation so failure becomes data rather than an exception — but the chaining must not happen during render, or each pass creates a new pending promise and the component suspends forever.
- **Handler failures reach no boundary at all.** Error boundaries cover render, effects, and lifecycle — not event handlers or async callbacks. An unspecified failing `onSubmit` does visibly nothing, which is the worst possible outcome and the easiest to miss.

### Effects

Most specified effects are not effects. Two gates, and only what fails both survives:

1. **Is it caused by a user action?** Then it's an event handler.
2. **Can it be expressed as something render returns?** Then it must be — a class, an attribute, an element, a conditional subtree, a `<title>`. An effect doing this by hand is a reimplementation of the reconciler, worse.

The second gate is the better one because it has a yes or no answer. "Is this system external?" invites a story — and *the document* can be made to justify anything. What survives both gates is the genuinely unowned surface: `window` and `document` listeners, `IntersectionObserver`, `ResizeObserver`, `matchMedia`, timers, storage, network, History, focus and scroll, layout measurement, and third-party imperative libraries.

Per-frame work is not an effect and does not go through `useEffect`; it has its own section, "Frame loop", below. The two gates still apply to it first.

For each surviving effect:

- **Cleanup** for every subscription, timer, and listener.
- **Double-invocation safety** — dev StrictMode mounts, unmounts, and remounts, so an effect that can't run twice is broken and will look fine in production until it isn't.
- **Race handling**, chosen by what triggered the work:

```js
// effect-initiated — cleanup gives per-run scoping for free
useEffect(() => {
  let ignore = false;
  fetchUser(id).then(data => { if (!ignore) setUser(data); });
  return () => { ignore = true; };
}, [id]);

// better when the operation takes a signal — a flag still pays for the response
useEffect(() => {
  const ctrl = new AbortController();
  fetch(url, { signal: ctrl.signal })
    .then(r => r.json())
    .then(setData)
    .catch(e => { if (e.name !== 'AbortError') setError(e); });
  return () => ctrl.abort();
}, [url]);

// handler-initiated — no cleanup exists to hang a flag on, so use a ref token
const latest = useRef(0);
async function onSearch(q) {
  const token = ++latest.current;
  const results = await search(q);
  if (token === latest.current) setResults(results);
}
```

Note the `AbortError` check — aborting rejects, so without it every cancellation renders as a failure.

Prefer `useSyncExternalStore` for external store subscriptions, `useLayoutEffect` only for measurement or DOM mutation that would otherwise flicker, and React 19's Actions — `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic` — over hand-rolling pending and optimistic state from `useState` plus an effect.

### Refs as inputs

A ref prop is an input whose value changes without a render. Scroll distance is the canonical case: the page scroller writes it every frame, and re-rendering a scene component on every scroll would be the bug. So a ref is a third input class beside props and context, and it gets its own section, `refs.*`, because it is invisible at the call site in a way even context isn't — the call site passes an object that never changes identity.

Each `refs.*` line says what the ref points at, who writes it and when, and which frame line reads it. Those three answers are the whole contract:

- **The writer is never this component's render.** Reading a ref during render is a BLOCK: render cannot see the ref change, so the output goes stale silently. Refs are read in the loop, in handlers, and in effects.
- **The writer's timing is a contract on the owner** (see "Unenforceable contracts"). A ref written after this component's frame work ran is one frame stale, and nothing reports it.
- **Internal refs** — the mesh, the material, a scratch vector — are listed too, marked `internal`, so every frame line's reads and writes resolve to something.

Props and state the loop needs are **mirrored into refs**, declared as `frame.sync.*` lines; the loop never closes over a prop or a state value. In `internal` mode fiber refreshes the callback every render, so a closure would work — but the same body must run under `handle` and `tunnel` mode, where nothing refreshes it, and one body that reads only refs is correct under all three.

### Frame loop

The loop is not an effect, and it is not free: whatever runs in it runs at the display's refresh rate for the life of the component. Both effect gates apply first — a user action is a handler, and anything render can express is render. What survives is continuous motion, values derived from refs that change without rendering, and uniforms.

**Where the loop runs is a spec decision, `frame.mode`,** because the three options have different ordering, context, and failure behavior, and a wrong guess fails silently in every case.

| Mode | Mechanism | Order of execution | Silent failure it introduces |
|---|---|---|---|
| `internal` | `useFrame(cb, priority)` inside the component, with `frame.args` passed exactly | Mount order among equal priorities; the spec cannot pin it | A positive priority switches off the root's automatic render |
| `handle` | The component exposes `frame(state, delta, xrFrame)` on its ref via `useImperativeHandle`; the owner calls it from one top-level `useFrame` in the order it chooses | Explicit, decided by the owner | Nothing runs unless the owner calls it |
| `tunnel` | The tunnel arrives as the prop named in `frame.tunnel`; the component renders `<tunnel.In>` containing a runner component that renders `null` and holds the `useFrame` | Mount order of `tunnel.Out` among that root's subscribers, then definition order among things sent into the tunnel | With `Out` unmounted, the loop never runs |

Consequences by mode:

- **`internal`.** Fiber sorts subscribers by priority, lowest first; equal priorities run in the order they subscribed, which is mount order. An ordering requirement under this mode is a tier ④ contract; the tier ① fix is to switch to `handle`, which is why an app-wide top-level loop exists at all. **Any subscriber with a priority above 0 disables automatic rendering for the whole root while it is mounted** — the fiber source: *"If this subscription was given a priority, it takes rendering into its own hands."* A `frame.args` priority above 0 therefore needs a frame line that calls `gl.render`, or the canvas goes black; that is a pre-flight BLOCK, not a default.
- **`handle`.** The handle's `frame` has the same signature as a `useFrame` callback unless the spec says otherwise, so the owner can forward its own arguments untouched. The handle is created once, with an empty dependency array, and reads everything through refs — a handle recreated with dependencies can be captured stale by the owner and there is no error for that. The owner's obligation to call it is a contract, tier ④, stated in the resolved spec. Other `handle.*` methods follow the same rule: read refs, write objects, never set state unless a `frame.writes-react` line says so.
- **`tunnel`.** The runner is rendered by whichever renderer mounts `Out`, so it does not see this component's context and receives only what it is handed as props: refs and stable values. It subscribes to the frame loop of the Canvas that hosts `Out`, not of any Canvas near this component. The runner gets `frame.args` exactly as `internal` mode would.

Body rules for all three modes:

- **Never set React state from the loop.** A `setState` per frame is a render per frame, and it fails as a slow site rather than as an error. `frame.writes-react: never` is the expectation; anything else is spelled out with the condition and rate, and tested for both.
- **Read refs, write objects.** Position, rotation, scale, uniforms, buffer attributes with `needsUpdate`. The React tree is not touched.
- **Scale by `delta` or read `state.clock`.** A per-frame increment runs twice as fast on a 120 Hz display and there is no error for that. Frame-count motion is a BLOCK unless the spec says frame-based.
- **No allocation per frame.** Scratch vectors and matrices live at module scope, never stored between frames — the module-scope rule above still applies, so they are shared and hold nothing — or in an internal ref.
- **Invalidation is declared, not assumed.** Under a Canvas with `frameloop="demand"`, a loop that mutates objects shows nothing until `invalidate()` is called, and the component cannot know which Canvas it is in. `frame.invalidate` says either that the Canvas is `always`, which becomes a contract on the owner, or which writes are followed by `invalidate` from `useThree`.
- **`frame.sync.*` covers both directions.** React → loop is a ref mirror or a resource rebuild. Loop → React is `frame.writes-react`, and it is the exception.

### Disposal

Anything that holds GPU or heap memory is listed under `dispose.*`, **keyed by object name** — `dispose.geometry`, `dispose.texture.noise`, `dispose.target.blur` — one line per object, each with its disposal moments. Missing disposal is the class of failure this skill exists for: the GPU leaks, the tab gets slower, and nothing reports it. Keying by name is what makes the check mechanical: every object the component creates must have a line, and every line must have a moment.

- **Fiber disposes what JSX declared.** On unmount it calls `dispose()` on every object the component declared as an element, unless that element carries `dispose={null}`. Those objects still get a line, with `fiber, on unmount` as the moment, so the list is complete and the reverse check has nothing to guess about. Declaring an object in JSX is the tier ① answer wherever it applies.
- **What the component creates itself, it disposes itself.** A geometry built in `useMemo`, a `DataTexture`, a render target, an instanced buffer: two moments each, disposal on unmount and disposal of the previous one when it is rebuilt. The rebuild moment is the one that gets forgotten.
- **Loader caches are shared.** `useLoader`, `useGLTF`, and `useTexture` cache by URL across the app; disposing what they return breaks the next consumer with no error here. They never get a `dispose.*` line.
- **`dispose={null}` is a spec line**, used when an object is shared with something outside this component, and the resolved spec names who disposes it instead.

**`handle.dispose()`** exists so the owner can free a component on demand the same way it drives its frame: unmounting is not always when the memory should go. When the spec lists it:

- It releases every `dispose.*` object, and it is idempotent: three.js `dispose()` calls are safe to repeat, and unmount still runs the normal disposal afterwards, so a second release must be a no-op rather than a second `new`.
- **A disposed object that is still rendered comes back.** three.js re-uploads a geometry or texture the next time a visible mesh references it, so calling `dispose()` on a live object frees nothing and shows nothing. `dispose.after` states what the component does to stop referencing them — hide the mesh, skip the frame lines, drop the material — and it is required whenever `handle.dispose` exists. That line is where the silent failure lives.
- After `handle.dispose()`, `handle.frame` and the other handle methods are no-ops. Calling them is not an error, because the owner's loop runs on.

### Bridges

Output that leaves this renderer is real output, in the same way portals and hoisted `<title>` tags are, and it is listed under `bridge.*` with its far end named.

- **tunnel-rat.** `tunnel()` returns `{ In, Out }`. `In` renders nothing where it stands; `Out` renders everything sent in, in definition order, in whichever renderer `Out` is mounted in. Context does not cross; props do. Two components sending into one tunnel are ordered, not colliding, but an `Out` that is never mounted swallows the content silently — that is a contract on the owner.
- **drei `<Html>`** puts DOM inside the scene. It is a DOM output and its markup lines are `markup.*` lines with the usual RTL assertions, run against where the `portal` prop says it lands.
- **fiber `createPortal(children, object3d)`** renders into another `Object3D`. A portal into an object this component does not own is the scene-side version of two `<title>` tags.

### Library

This repo is a package, so the component's public surface is not only its props.

- **`library.export`** names the export added to `src/index.js` — a named export, matching the component name, the one line outside the component's own files that this skill writes.
- **`library.side-effects`** declares anything that runs at module scope and must run: an `extend()` registering a custom element, a `shaderMaterial` definition. `package.json` says `sideEffects: false`, so a module whose exports go unused is dropped whole, together with whatever it registered. `none` is the expected value; anything else is a NOTE in the report.
- Imports come only from the declared peers, which are all optional. That is already covered by the imports check; it is named here because a new peer is a `package.json` change, and that is a report, not something this skill does.

### Unenforceable contracts

Derived, not invented. Walk the sections above and each entry falls out: props in a dependency array produce a stability contract, required context produces a provider contract, measurement produces a layout precondition, rendering a list produces the downward key contract, throws and suspends produce boundary contracts, an external system with expensive setup produces a remount cost. On the scene side: a ref prop produces a writer contract (who writes it, and before this component's frame work), `internal` mode with an ordering need produces an ordering contract, `handle` mode produces a caller contract, `tunnel` mode produces an `Out`-mounted contract, `frame.invalidate: not needed` produces a frameloop contract, `dispose={null}` produces a disposer contract, and `handle.dispose` produces a caller contract in the cases where unmount is too late.

This section carries the most weight because these are precisely the failures nothing else catches — which is the same reason they block rather than default.

Every entry gets a mitigation tier. The first two are worth reaching for; if a contract sits at tier ④ it usually means a design decision hasn't been made yet.

| Tier | Action |
|---|---|
| ① Remove | Change the mechanism so the contract stops existing — take an element instead of a component reference; return an error state instead of throwing; render your own Suspense boundary around a lazy child; switch `internal` to `handle` so ordering is the owner's explicit choice; declare a resource in JSX so fiber disposes it |
| ② Throw | A missing required provider throws, naming the provider; a required ref prop that is not a ref object throws at mount |
| ③ Warn in dev | Measure zero height and warn; warn when a prop marked stable changes identity every render; count mounts and warn past a threshold; warn when a required ref is still `undefined` on the first frame |
| ④ Document and test | The JS prop contract, the keys this component assigns, the owner's call to `handle.frame`, the mounted `Out` |

**Tier ③ only works if the guard matches the target,** or the warnings ship to users:

| Target | Dev guard |
|---|---|
| Next | `process.env.NODE_ENV !== 'production'` |
| Vite | `import.meta.env.DEV` |
| portable | `process.env.NODE_ENV !== 'production'` — the one bundler convention every consumer replaces; this repo's lib build leaves it in place for the consumer (verified), so the guard survives to the consumer's build and is resolved there |

### Target differences

| | Next | Vite | portable |
|---|---|---|---|
| Public env | `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` | none |
| `"use client"` | emit | omit | omit in source; the build banner stamps it on `dist/index.js` |
| `runtime` field | real | always client | always client |
| Assets | static import / `next/image` | `?url`, `?raw` | `new URL(..., import.meta.url)` |
| Lazy without SSR | `next/dynamic` with `ssr: false` | `lazy` | `lazy` |

### Naming and files

- PascalCase component names — JSX treats a lowercase tag as a host element.
- `.jsx` for any file containing JSX. Under Vite, JSX in a `.js` file isn't transformed and fails at parse, so this is a build fact rather than a preference.
- One folder per component: `src/Button/index.jsx` holds the component, beside `Button.spec.md`, `Button.resolved.md`, `Button.test.jsx`, and any helper used only by this component. A helper that is reusable and React-free goes to `src/utils/` as a plain function with its own test, and is not exported from the package until something outside needs it.
- `src/index.js` is the only barrel, and it is the package entry by design, so tree-shaking is unaffected. No other index file re-exports anything; `src/Button/index.jsx` defines the component, it does not gather.
- **No silent renaming.** Names in the code match the spec input exactly — no pluralization fixes, no normalizing a handler to an `on` prefix, no tidying. Completeness is checked by tracing spec ids, so a rename breaks the trace. A wrong name in the spec is a report, not a correction.

### Pragmas

Enabling pragmas are stated inputs: `@jsxImportSource`, `"use memo"` / `"use no memo"`, webpack magic comments.

Suppressing pragmas are prohibited: no `eslint-disable`, no `@ts-expect-error`. Reaching for those deletes the evidence that the output is wrong, which is the opposite of this skill's job.

---

## Tests

Derived from the spec, not written from intuition. Roughly half the list is negative tests — doesn't fire, doesn't re-sync, stale response loses, cleanup left nothing behind — and those are exactly the ones that go missing otherwise.

Scene output is tested with `@react-three/test-renderer`: `create(element)` renders into a headless root, `renderer.scene` exposes the graph, `advanceFrames(frames, delta)` inside `act` runs the loop with a chosen delta, `unmount()` triggers disposal — and in that environment fiber disposes immediately rather than at idle, so disposal is assertable synchronously. It is a devDependency to add, alongside the runner, and until it is present the scene rows below are reported as untested rather than skipped. DOM output that crosses a bridge is tested with RTL at the far end.

| Spec source | Generates |
|---|---|
| `markup.*` role + accessible name | `getByRole('button', { name: 'Save' })` |
| Native element required | Assert the tag — `getByRole('button')` matches `<div role="button">` too |
| Contract attributes | `type="button"`, `href`, `disabled`. A button in a form without `type` submits it |
| State-reflecting attributes | `aria-expanded`, `aria-selected` per state |
| Text content | Specified strings, interpolation, plural forms |
| Conditional subtrees | Present when the condition holds, **absent when it doesn't** |
| Containment and association | Options inside the listbox; `aria-describedby` resolves to the real error text |
| Focus | Lands where specified on open, returns on close, tab order matches |
| `states.*` | One test per enumerated state |
| `callbacks.*` | Fires when specified with the specified payload; **doesn't fire when it shouldn't** |
| `props.passthrough` / `props.ref` | A passed `className` and `ref` land where the spec says |
| `context.provided` | A consumer below sees the specified value |
| `exits.throws` / `exits.suspends` | Rendered inside a boundary, the fallback appears |
| `exits.handler-failures` | The specified behavior — nothing else covers this |
| `effects.*` | Cleanup removed it; mounting twice doesn't duplicate; out-of-order resolution lets the stale one lose; changing an unrelated value **doesn't** re-sync |
| `refs.*` | Set `ref.current`, advance one frame, the specified write reflects it; **the component did not re-render** |
| `frame.*` under `internal` | `advanceFrames(1, delta)` produces each write; two deltas produce proportionally different results when scaled by delta; `frame.args` reached `useFrame` |
| `frame.*` under `handle` | `ref.current.frame(state, delta)` produces each write; **advancing frames without calling it produces nothing** |
| `frame.*` under `tunnel` | With `Out` mounted in a root, advancing that root's frames produces the writes; **with `Out` unmounted, nothing moves** |
| `frame.writes-react` | `never`: render count unchanged across N frames; otherwise the stated condition sets it and nothing else does |
| `frame.args` priority above 0 | The callback renders — `gl.render` is called once per frame |
| `frame.invalidate` | `invalidate` called after the stated writes; **not called** by anything else |
| `frame.sync.*` | Changing the prop changes the next frame's result; changing an unrelated prop **doesn't** rebuild |
| `handle.*` | Each named method exists and does what its line says |
| `dispose.<name>` | That object's `dispose` called on unmount, and on the old one when rebuilt; **not called** on an unrelated re-render; a `dispose={null}` object is untouched |
| `handle.dispose` / `dispose.after` | One call disposes every listed object; a second call disposes nothing new; after it, frames write nothing and the after-state holds; unmount afterwards does not throw |
| `bridge.*` | Content appears at the far end, in the stated order; gone after unmount |
| `library.export` | The name is importable from `src/index.js` |
| Tier ② and ③ mitigations | The throw throws with its message; the dev warning fires |

Unenforceable contracts aren't testable — testing them means testing the parent — but their *mitigations* are, which is another reason to prefer tiers ② and ③.

**Every markup line in the spec is required to have a test.** The filter is presence in the spec, not your judgment about what matters: the user only writes lines they mean. A line that varies by state gets one test per state; a line that doesn't is complete after one.

**Test names carry the spec id**, because traceability in a separate document drifts the first time someone edits a test, while traceability in test names is re-verified on every run:

```js
it('[markup.1] renders a button named Save', ...)
it('[states.empty] renders the empty message, not the zero-results message', ...)
it('[callbacks.neg.1] does not fire onSelect while disabled', ...)
it('[effects.1] removes the resize listener on unmount', ...)
it('[frame.1] moves the mesh by scroll × amplitude after one frame', ...)
it('[frame.1] does not move the mesh when handle.frame is not called', ...)
it('[dispose.geometry] disposes the previous geometry when size changes', ...)
it('[handle.3] disposes nothing new on a second call', ...)
```

Test through the public interface — render and interact, never assert on internal state. Query by role and label, which re-tests the semantics for free. On the scene side the public interface is the scene graph and the handle: assert object properties after a frame, never the closure that produced them. No whole-tree snapshots: a snapshot asserts everything and specifies nothing, so every intentional change looks like a failure and gets approved without being read. And don't test React itself.

---

## Definition of done

Traceability in both directions, plus a green suite.

- **Forward** — every spec input id appears in a test name, as does every `contracts.*` entry at tier ② or ③. A missing id is a missing test.
- **Reverse** — every element a user or assistive technology can perceive traces to a spec line, and on the scene side every object in the graph and every write the loop makes traces to a `markup.*`, `frame.*`, or `dispose.*` line. An unspecified wrapper `<div>` is an implementation detail; an unspecified *label* is a finding. Report it as either a spec gap or an overreach on your part, and don't guess which.

The reverse check is the more valuable of the two, because it's the only thing that catches output nobody asked for. Untested markup is the signal for unrequested markup.

Coverage percentages are not the target. The spec defines completeness, which is why coverage-ignore pragmas never need to appear.

## Artifacts

- `src/Button/index.jsx` — the component
- `src/Button/Button.test.jsx` — the tests
- `src/Button/Button.spec.md` — the spec input, authored by the user. Kept beside the component so the ids in the tests are navigable and the reasoning survives. Never edited by this skill.
- `src/Button/Button.resolved.md` — the resolved spec, written by this skill
- `docs/Button.md` — the API doc: props, handle, dispose rules, limits. Written for the consumer, so it repeats nothing about the run.
- `src/index.js` — one named export line added, per `library.export`
- The run report — in conversation, not a file. It's about this run, not about the code.

### The resolved spec

The spec input is what the user asserted. The resolved spec is what the component was actually built against: the input plus everything derived from it. Writing it as a separate file is what lets the input stay untouched while still producing a single document that describes the finished component.

Derived entries get their own id namespaces so tests can reference them the same way:

```markdown
# Button — resolved

## contracts            # derived, one per unenforceable contract
contracts.1: onSelect must be referentially stable — owner caller — tier ③ — effect re-runs every render
contracts.2: ThemeProvider must exist above — owner ancestor — tier ② — throws naming the provider
contracts.3: keys for the option list — owner self — tier ④ — options remount and lose focus
contracts.4: `scroll` ref written before this frame's handle call — owner caller — tier ③ — one frame stale, warns if undefined on first frame
contracts.5: owner calls handle.frame every frame — owner caller — tier ④ — nothing moves

## defaults            # taken because a wrong guess fails loudly
defaults.1: root = single element — required as the passthrough target by props.passthrough

## notes
notes.1: eleven props with a component-reference slot; the injected-name coupling is now the widest part of the API

## gaps                # the field model had nowhere to put these
gaps.1: "scroll position survives a route change" — no field expresses cross-instance persistence
```

`contracts.*` ids appear in test names wherever the mitigation is testable — a tier ② throw and a tier ③ warning both get one. Tier ④ entries have no test by definition, which is visible rather than hidden.

## React 19 reference

Facts this skill depends on, all confirmed against react.dev:

- `ref` is a regular prop for function components — *"Starting in React 19, you can now access `ref` as a prop for function components"*. `forwardRef` is unnecessary.
- Ref callbacks may return a cleanup function, called when the element leaves the DOM.
- `<Context>` renders as a provider directly; `<Context.Provider>` is slated for deprecation.
- `propTypes` — *"In React 19, we're removing the `propType` checks from the React package, and using them will be silently ignored."* `defaultProps` is gone for function components; use ES6 default parameters.
- `use` may be called in loops and conditionals, and cannot be called inside try/catch.
- `<title>`, `<meta>`, and `<link>` rendered anywhere are hoisted into `<head>`.
- Actions: `useActionState`, `useFormStatus`, `useOptimistic`, and `action` / `formAction` props on forms.

## react-three-fiber reference

Facts this skill depends on, confirmed against the installed packages (`@react-three/fiber` 9.7.0, `@react-three/drei` 10.7.8, `tunnel-rat` 0.1.2) and the `@react-three/test-renderer` 9.x API document:

- `useFrame(callback, renderPriority = 0)`; the callback is `(state, delta, xrFrame?) => void`. Fiber stores the latest callback in a ref on every render, so an `internal` loop never runs a stale closure.
- Subscribers are sorted by priority, lowest first; equal priorities run in subscription order. While any subscriber has a priority above 0, the root's own `gl.render(scene, camera)` does not run — the source comment: *"As long as this flag is positive there can be no internal rendering at all."*
- `frameloop` is `'always' | 'demand' | 'never'`. `invalidate(frames = 1)` from `useThree` requests frames under `demand`; under `never` nothing runs, and under `always` it is a no-op.
- On unmount fiber calls `dispose()` on every object declared in JSX, scheduled at idle priority, unless the element has `dispose={null}`. In a test environment (`IS_REACT_ACT_ENVIRONMENT` defined) disposal is immediate.
- `createPortal(children, object3d)` renders children into another `Object3D`.
- `tunnel()` returns `{ In, Out }`; `In` renders `null`; `Out` renders everything sent in, in definition order, in the renderer that mounts it.
- drei `useGLTF`, `useTexture`, `useFBX` are built on `useLoader` and suspend on first load; results are cached by URL. drei `useFBO` disposes its render target on unmount. drei `<Html>` takes `portal`, `transform`, and `occlude`.
- `@react-three/test-renderer`: `create(element)`, `renderer.scene`, `getInstance()`, `toTree()`, `toGraph()`, `fireEvent()`, `advanceFrames(frames, delta)`, `update(element)`, `unmount()`, and `act()`. Peer requirement: fiber 9 or later, React 19.