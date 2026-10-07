# Demo spec

Written 2026-10-07 from Izzy's answers in the demo skill's REPL (`.claude/skills/demo/SKILL.md`); the wrapper every `<Name>.demo.jsx` renders into. Where a line is my call rather than an answer, it says so.

## meta

meta.target: portable
meta.runtime: client
meta.file: src/Demo/index.jsx, src/Demo/useSettings.js

## imports

imports.1: import { useId, useRef, useState } from 'react' (index.jsx)
imports.2: import { useCallback, useMemo, useState } from 'react' (useSettings.js)

## props

props.1: settings — the object useSettings returns ({ schema, values, set, reset, key }), required; the sidebar renders schema and values and calls set and reset
props.2: openSettings — boolean, optional; when given the sidebar's open state is controlled by it, otherwise the toggle button owns it (Izzy: "open or closed controlled by openSettings prop, or on click of a toggle button")
props.3: onOpenSettingsChange — (open: boolean) => void, optional; called with the next state whenever the toggle or Escape asks for a change, controlled or not
props.4: demoContainerClass — string, optional; appended to the root's class list, so the site's rules override the internals
props.5: demoContainerStyle — object, optional; merged last onto the root's inline style
props.6: settingContainerClass — string, optional; appended to the sidebar's class list
props.7: settingContainerStyle — object, optional; merged last onto the sidebar's inline style
props.8: theme — string, optional; lands as `data-theme` on the root for the site's CSS, absent when not given (Izzy: "maybe just a theme prop will do. up to you")
props.9: label — string, optional, default 'Settings'; the toggle's accessible name and the sidebar's
props.passthrough: yes → spread onto the root <div>
props.ref: accepted → root DOM node (the scene's root is the demo's own ref, on the group it sends through the tunnel; not this component's)

## slots

slots.mechanism: children
slots.1: children — the demo's `<tunnel.In>` with its fiber root, rendered inside the stage (markup.3); nothing is wrapped around it

## context

context.consumed: none
context.provided: none
context.hook.1: useSettings(schema) — validates the schema once (exits.throws), holds the values, initial every entry's default; returns { schema, values, set(key, value), reset(), key }; `key` is a string that changes only when an entry with `live: false` changes, for a scene to remount on (my call: a demo keys its scene with it)

## state

state.1: open — boolean, internal, initial false; used only when props.2 is undefined
state.2: values — object keyed by schema key, in useSettings, initial the defaults
state.reset: useSettings.reset() returns state.2 to the defaults; nothing else resets

## markup

markup.1: root <div class="cocoon-demo" data-theme=props.8> position relative, display flex, width 100%, height 100%, overflow hidden, box-sizing border-box, no border, margin or padding; className then props.4, style then props.5, then passthrough
markup.2: the stage <div class="cocoon-demo__stage"> position relative, flex 1 1 auto, min-width 0, height 100%; holds children (slots.1). It shrinks when the sidebar is shown and expands when it is hidden, by the flex layout alone
markup.3: the toggle <button type="button" class="cocoon-demo__toggle" aria-expanded=open aria-controls=markup.4's id> with accessible name props.9; position absolute, top 0, right 0, inside the stage
markup.4: the sidebar <aside id class="cocoon-demo__settings" aria-label=props.9 hidden when closed> flex 0 1 auto, max-width 50%, min-width 0, height 100%, overflow auto, box-sizing border-box, so it never collapses the stage (found in the fluid demo's browser test: an unbounded sidebar took the whole container); className then props.6, style then props.7
markup.5: in the sidebar, one <fieldset class="cocoon-demo__group"> per distinct `group` in schema order, with a <legend> of the group's name; entries with no group go in a fieldset with no legend, first
markup.6: one control per schema entry whose `when` holds (markup.11), in schema order within its group: a <label for=id>entry.label or the key</label> and the input, each wrapped in <div class="cocoon-demo__field" data-kind=kind>
markup.7: kind number: <input type="range" id min max step value> and an <output for=id> showing the value
markup.8: kind boolean: <input type="checkbox" id checked>
markup.9: kind select: <select id> with one <option value> per options entry, an entry being a string or { value, label }
markup.10: kind colour: <input type="color" id value>
markup.11: kind vector: one <input type="number" id-n step> per component, labelled by the component's name from entry.components (default x, y, z), inside a <fieldset class="cocoon-demo__vector"> with a <legend> of the entry's label
markup.12: an entry with `when: { key, value }` is rendered only while values[key] === value; otherwise absent
markup.13: last in the sidebar, <button type="button" class="cocoon-demo__reset">Reset</button>

## states

states.default: markup.1–13 with the sidebar hidden: props.2 false, or props.2 undefined and state.1 false
states.open: markup.1–13 with the sidebar shown (the hidden attribute absent), aria-expanded true on the toggle
states.disabled: none
states.pending: none
states.empty: a schema with no entries renders the sidebar with the reset button only
states.error: none

## callbacks

callbacks.1: the toggle's click → the next open state is !open; props.3 fires with it; state.1 takes it when props.2 is undefined
callbacks.2: an input's change → settings.set(key, value) with the value typed by kind: number for range and vector components, boolean for checkbox, string for select and colour; a vector sets the whole array with one component replaced
callbacks.3: the reset button's click → settings.reset()
callbacks.4: Escape keydown inside the sidebar → the next open state is false (as callbacks.1), and focus returns to the toggle
callbacks.neg.1: when props.2 is given, the toggle and Escape change nothing on their own; only props.3 fires

## effects

effects: none

## exits

exits.throws: useSettings throws at its first call, naming the key, when an entry has no kind or an unknown one, a select has no options, a number has no default, or a vector's default is not an array; Demo throws from render when props.1 is not what useSettings returns, naming useSettings. Owner: the nearest error boundary
exits.suspends: never
exits.handler-failures: none

## library

library.export: named `Demo` from src/index.js, and `useSettings` from src/index.js (src/Demo/useSettings.js); the demos entry re-exports both when it exists
library.side-effects: none
library.helper: none
library.generated: none
library.script: none
library.docs: docs/Demo.md — props, the schema format, useSettings, the class names and the inline layout, how a demo file uses it
