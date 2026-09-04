---
name: react-component-from-spec
description: 'Build a React 19 component and its RTL tests from a structured spec input, validating the spec before writing any code.'
---

# React Component From Spec

Build a React 19 component and its tests from a structured spec input. The spec input is written by the user; your job is to validate it, build exactly what it describes, and report anything you could not resolve.

The organizing principle for every judgment call in this skill:

**Default when a wrong guess fails loudly. Block when it fails silently.**

A wrong guess that breaks the build or a test costs one cycle. A wrong guess that renders a component invisible, drops an event, or lets a stale response win costs a debugging session weeks later. Everything below is an application of that one rule.

## Scope

- **React 19.** Later 19.x is fine — the API is additive. Do not apply this skill to React 18.
- **JavaScript with JSDoc.** No TypeScript, no `propTypes`. React 19 removed `propTypes` checking entirely and ignores it silently, so JSDoc plus tests is the whole enforcement story.
- **Tests with React Testing Library.** Runner-agnostic.
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

meta.target: vite # next | vite | portable — required
meta.runtime: client # client | server | shared
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
props.ref: accepted → root DOM node

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

---

## Pre-flight checklist

Each row is answerable by reading the spec input alone.

| Check                         | Fails when                                                         |
| ----------------------------- | ------------------------------------------------------------------ |
| Required fields present       | `meta.target`, `meta.runtime`, slots, or props missing entirely    |
| Explicit `none`               | A required section omitted rather than set to `none`               |
| Every render state has markup | A state enumerated with nothing to render                          |
| Callbacks complete            | A callback missing its trigger, payload, or ordering               |
| Effects survive both gates    | See "Effects" below                                                |
| Dep-array props marked stable | An effect depends on a prop with no stability contract             |
| Exits have boundary decisions | A throw or suspend with no owner named                             |
| Imports closed both ways      | Something used but not declared, or declared but not used          |
| Ownership consistent          | A rendering decision needs data the chosen slot mechanism excludes |
| Markup lines are queryable    | A markup line with no possible RTL assertion                       |
| Target syntax matches target  | `import.meta.env` under Next, `"use client"` under Vite            |

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

- `"use client"` as the literal first line when the target is Next and the runtime is client. Under Vite it is inert — do not emit it.
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

| Situation                                           | Mechanism                   |
| --------------------------------------------------- | --------------------------- |
| Caller supplies content                             | `children` or element props |
| Data flows child → caller                           | render prop                 |
| Caller swaps an implementation, child owns the data | component reference         |
| A family of related parts                           | compound components         |

An element prop gets a fresh identity every parent render, so it can never be an effect dependency. A component reference is stable, but the child then decides what prop name the data arrives under — a coupling that appears in neither file's prop list.

**Passed props always win over injected ones**, unless the spec says otherwise.

### Outputs

The markup comes from the spec input. Do not invent structure, and do not improve on what's written.

Semantics are the output, not a layer on it — a native `<button>` rather than `<div role="button">`, because the roles, labels, and focus order are what the component actually produces.

Two structural decisions with consequences elsewhere: whether the root is a single element or a fragment, and what the root is. A fragment root has no obvious default ref target and nowhere for `className` passthrough to land, which silently invalidates `props.passthrough`.

**Render states are where specs fail most often.** Build every state the spec enumerates. `empty` and `not yet asked` are different states; a transition that keeps the previous UI on screen while pending is a different output from a spinner replacing it.

**Keys are the one contract that points downward.** This component's identity is assigned by its parent, but its children's identity is assigned by it. A wrong key remounts subtrees that had every right to persist.

**Output that escapes the subtree** is real output and can collide with siblings: portals, and React 19's metadata hoisting — _"When React renders this component, it will see the `<title>` `<link>` and `<meta>` tags, and automatically hoist them to the `<head>` section of document."_ Two components each rendering a `<title>` is last-one-wins with no error.

### Exit channels

A render can return, throw, or suspend. All three are specified.

- **Throw** — the nearest error boundary catches it. With no boundary, React unmounts the whole tree and the user gets a blank screen. Prefer returning an error state over throwing when the spec allows.
- **Suspend** — the nearest Suspense boundary shows its fallback; a rejected promise reaches the nearest error boundary. `use` is not a hook and may be called conditionally, but it **cannot be called inside try/catch** — suspension is implemented as a throw, so catching it would swallow React's own control flow. Per-read error handling therefore isn't available: error granularity equals boundary granularity equals component granularity. The escape hatch is to catch at promise creation so failure becomes data rather than an exception — but the chaining must not happen during render, or each pass creates a new pending promise and the component suspends forever.
- **Handler failures reach no boundary at all.** Error boundaries cover render, effects, and lifecycle — not event handlers or async callbacks. An unspecified failing `onSubmit` does visibly nothing, which is the worst possible outcome and the easiest to miss.

### Effects

Most specified effects are not effects. Two gates, and only what fails both survives:

1. **Is it caused by a user action?** Then it's an event handler.
2. **Can it be expressed as something render returns?** Then it must be — a class, an attribute, an element, a conditional subtree, a `<title>`. An effect doing this by hand is a reimplementation of the reconciler, worse.
   The second gate is the better one because it has a yes or no answer. "Is this system external?" invites a story — and _the document_ can be made to justify anything. What survives both gates is the genuinely unowned surface: `window` and `document` listeners, `IntersectionObserver`, `ResizeObserver`, `matchMedia`, timers, storage, network, History, focus and scroll, layout measurement, and third-party imperative libraries.

For each surviving effect:

- **Cleanup** for every subscription, timer, and listener.
- **Double-invocation safety** — dev StrictMode mounts, unmounts, and remounts, so an effect that can't run twice is broken and will look fine in production until it isn't.
- **Race handling**, chosen by what triggered the work:

```js
// effect-initiated — cleanup gives per-run scoping for free
useEffect(() => {
  let ignore = false
  fetchUser(id).then((data) => {
    if (!ignore) setUser(data)
  })
  return () => {
    ignore = true
  }
}, [id])

// better when the operation takes a signal — a flag still pays for the response
useEffect(() => {
  const ctrl = new AbortController()
  fetch(url, { signal: ctrl.signal })
    .then((r) => r.json())
    .then(setData)
    .catch((e) => {
      if (e.name !== 'AbortError') setError(e)
    })
  return () => ctrl.abort()
}, [url])

// handler-initiated — no cleanup exists to hang a flag on, so use a ref token
const latest = useRef(0)
async function onSearch(q) {
  const token = ++latest.current
  const results = await search(q)
  if (token === latest.current) setResults(results)
}
```

Note the `AbortError` check — aborting rejects, so without it every cancellation renders as a failure.

Prefer `useSyncExternalStore` for external store subscriptions, `useLayoutEffect` only for measurement or DOM mutation that would otherwise flicker, and React 19's Actions — `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic` — over hand-rolling pending and optimistic state from `useState` plus an effect.

### Unenforceable contracts

Derived, not invented. Walk the sections above and each entry falls out: props in a dependency array produce a stability contract, required context produces a provider contract, measurement produces a layout precondition, rendering a list produces the downward key contract, throws and suspends produce boundary contracts, an external system with expensive setup produces a remount cost.

This section carries the most weight because these are precisely the failures nothing else catches — which is the same reason they block rather than default.

Every entry gets a mitigation tier. The first two are worth reaching for; if a contract sits at tier ④ it usually means a design decision hasn't been made yet.

| Tier                | Action                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ① Remove            | Change the mechanism so the contract stops existing — take an element instead of a component reference; return an error state instead of throwing; render your own Suspense boundary around a lazy child |
| ② Throw             | A missing required provider throws, naming the provider                                                                                                                                                  |
| ③ Warn in dev       | Measure zero height and warn; warn when a prop marked stable changes identity every render; count mounts and warn past a threshold                                                                       |
| ④ Document and test | The JS prop contract, and the keys this component assigns                                                                                                                                                |

**Tier ③ only works if the guard matches the target,** or the warnings ship to users:

| Target   | Dev guard                                                           |
| -------- | ------------------------------------------------------------------- |
| Next     | `process.env.NODE_ENV !== 'production'`                             |
| Vite     | `import.meta.env.DEV`                                               |
| portable | none available — tier ③ is off the table, those contracts fall to ④ |

### Target differences

|                  | Next                             | Vite                     | portable                        |
| ---------------- | -------------------------------- | ------------------------ | ------------------------------- |
| Public env       | `process.env.NEXT_PUBLIC_*`      | `import.meta.env.VITE_*` | none                            |
| `"use client"`   | emit                             | omit                     | omit                            |
| `runtime` field  | real                             | always client            | always client                   |
| Assets           | static import / `next/image`     | `?url`, `?raw`           | `new URL(..., import.meta.url)` |
| Lazy without SSR | `next/dynamic` with `ssr: false` | `lazy`                   | `lazy`                          |

### Naming and files

- PascalCase component names — JSX treats a lowercase tag as a host element.
- `.jsx` for any file containing JSX. Under Vite, JSX in a `.js` file isn't transformed and fails at parse, so this is a build fact rather than a preference.
- `Button.jsx`, flat — not `Button/index.jsx`. Index files make every editor tab say "index," and barrel re-exports quietly defeat tree-shaking.
- **No silent renaming.** Names in the code match the spec input exactly — no pluralization fixes, no normalizing a handler to an `on` prefix, no tidying. Completeness is checked by tracing spec ids, so a rename breaks the trace. A wrong name in the spec is a report, not a correction.

### Pragmas

Enabling pragmas are stated inputs: `@jsxImportSource`, `"use memo"` / `"use no memo"`, webpack magic comments.

Suppressing pragmas are prohibited: no `eslint-disable`, no `@ts-expect-error`. Reaching for those deletes the evidence that the output is wrong, which is the opposite of this skill's job.

---

## Tests

Derived from the spec, not written from intuition. Roughly half the list is negative tests — doesn't fire, doesn't re-sync, stale response loses, cleanup left nothing behind — and those are exactly the ones that go missing otherwise.

| Spec source                       | Generates                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `markup.*` role + accessible name | `getByRole('button', { name: 'Save' })`                                                                                                                |
| Native element required           | Assert the tag — `getByRole('button')` matches `<div role="button">` too                                                                               |
| Contract attributes               | `type="button"`, `href`, `disabled`. A button in a form without `type` submits it                                                                      |
| State-reflecting attributes       | `aria-expanded`, `aria-selected` per state                                                                                                             |
| Text content                      | Specified strings, interpolation, plural forms                                                                                                         |
| Conditional subtrees              | Present when the condition holds, **absent when it doesn't**                                                                                           |
| Containment and association       | Options inside the listbox; `aria-describedby` resolves to the real error text                                                                         |
| Focus                             | Lands where specified on open, returns on close, tab order matches                                                                                     |
| `states.*`                        | One test per enumerated state                                                                                                                          |
| `callbacks.*`                     | Fires when specified with the specified payload; **doesn't fire when it shouldn't**                                                                    |
| `props.passthrough` / `props.ref` | A passed `className` and `ref` land where the spec says                                                                                                |
| `context.provided`                | A consumer below sees the specified value                                                                                                              |
| `exits.throws` / `exits.suspends` | Rendered inside a boundary, the fallback appears                                                                                                       |
| `exits.handler-failures`          | The specified behavior — nothing else covers this                                                                                                      |
| `effects.*`                       | Cleanup removed it; mounting twice doesn't duplicate; out-of-order resolution lets the stale one lose; changing an unrelated value **doesn't** re-sync |
| Tier ② and ③ mitigations          | The throw throws with its message; the dev warning fires                                                                                               |

Unenforceable contracts aren't testable — testing them means testing the parent — but their _mitigations_ are, which is another reason to prefer tiers ② and ③.

**Every markup line in the spec is required to have a test.** The filter is presence in the spec, not your judgment about what matters: the user only writes lines they mean. A line that varies by state gets one test per state; a line that doesn't is complete after one.

**Test names carry the spec id**, because traceability in a separate document drifts the first time someone edits a test, while traceability in test names is re-verified on every run:

```js
it('[markup.1] renders a button named Save', ...)
it('[states.empty] renders the empty message, not the zero-results message', ...)
it('[callbacks.neg.1] does not fire onSelect while disabled', ...)
it('[effects.1] removes the resize listener on unmount', ...)
```

Test through the public interface — render and interact, never assert on internal state. Query by role and label, which re-tests the semantics for free. No whole-tree snapshots: a snapshot asserts everything and specifies nothing, so every intentional change looks like a failure and gets approved without being read. And don't test React itself.

---

## Definition of done

Traceability in both directions, plus a green suite.

- **Forward** — every spec input id appears in a test name, as does every `contracts.*` entry at tier ② or ③. A missing id is a missing test.
- **Reverse** — every element a user or assistive technology can perceive traces to a spec line. An unspecified wrapper `<div>` is an implementation detail; an unspecified _label_ is a finding. Report it as either a spec gap or an overreach on your part, and don't guess which.
  The reverse check is the more valuable of the two, because it's the only thing that catches output nobody asked for. Untested markup is the signal for unrequested markup.

Coverage percentages are not the target. The spec defines completeness, which is why coverage-ignore pragmas never need to appear.

## Artifacts

- `Button.jsx` — the component
- `Button.test.jsx` — the tests
- `Button.spec.md` — the spec input, authored by the user. Kept beside the component so the ids in the tests are navigable and the reasoning survives. Never edited by this skill.
- `Button.resolved.md` — the resolved spec, written by this skill
- The run report — in conversation, not a file. It's about this run, not about the code.

### The resolved spec

The spec input is what the user asserted. The resolved spec is what the component was actually built against: the input plus everything derived from it. Writing it as a separate file is what lets the input stay untouched while still producing a single document that describes the finished component.

Derived entries get their own id namespaces so tests can reference them the same way:

```markdown
# Button — resolved

## contracts # derived, one per unenforceable contract

contracts.1: onSelect must be referentially stable — owner caller — tier ③ — effect re-runs every render
contracts.2: ThemeProvider must exist above — owner ancestor — tier ② — throws naming the provider
contracts.3: keys for the option list — owner self — tier ④ — options remount and lose focus

## defaults # taken because a wrong guess fails loudly

defaults.1: root = single element — required as the passthrough target by props.passthrough

## notes

notes.1: eleven props with a component-reference slot; the injected-name coupling is now the widest part of the API

## gaps # the field model had nowhere to put these

gaps.1: "scroll position survives a route change" — no field expresses cross-instance persistence
```

`contracts.*` ids appear in test names wherever the mitigation is testable — a tier ② throw and a tier ③ warning both get one. Tier ④ entries have no test by definition, which is visible rather than hidden.

## React 19 reference

Facts this skill depends on, all confirmed against react.dev:

- `ref` is a regular prop for function components — _"Starting in React 19, you can now access `ref` as a prop for function components"_. `forwardRef` is unnecessary.
- Ref callbacks may return a cleanup function, called when the element leaves the DOM.
- `<Context>` renders as a provider directly; `<Context.Provider>` is slated for deprecation.
- `propTypes` — _"In React 19, we're removing the `propType` checks from the React package, and using them will be silently ignored."_ `defaultProps` is gone for function components; use ES6 default parameters.
- `use` may be called in loops and conditionals, and cannot be called inside try/catch.
- `<title>`, `<meta>`, and `<link>` rendered anywhere are hoisted into `<head>`.
- Actions: `useActionState`, `useFormStatus`, `useOptimistic`, and `action` / `formAction` props on forms.
