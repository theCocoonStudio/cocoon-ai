---
name: demo
description: "Build a component's demo for the site: DOM markup that fills a div, a settings sidebar driven by a schema, and a scene sent through a tunnel into the site's one Canvas. Arguments: <Component>, with Izzy's scene spec and effects list as the input."
---

# Demo

Every component in this package is a demo for the site, which wraps it in its own styling ("easy wrap"). A demo is the component's scene under the site's conditions, with its settings exposed, so the article's reader can play with what the article describes. Izzy writes the article; the demo and its code are mine.

## What a demo is

- **Markup placed in a div** on a site demo page. It fills its container, never taller than the viewport minus the site's nav; no overflow, border, margin or padding of its own. The settings are a sidebar beside it, open or closed through the `openSettings` prop or its toggle button, scrolling vertically when taller than the demo. The demo area shrinks when the sidebar opens and expands when it closes, and the scene follows its container's rect, so the objects re-cover the new area.
- **No Canvas.** The site has one Canvas, viewport-sized and fixed behind the whole site, and passes a tunnel (`tunnel-rat`) as the `tunnel` prop. The markup is literally `<div><tunnel.In><group /></tunnel.In><div className="settings" /></div>`: the container, the fiber root through the tunnel, the settings beside it; the site renders `<tunnel.Out />` into a full-viewport View in its Canvas.
- **No scissor, no View.** The scene places and sizes its objects to cover the container's rect at the camera's depth, from the rect and the camera, by its own maths. Anything sized from a viewport (the fluid's targets) is sized from the div, not the Canvas.
- **The root is exposed** through `ref`: the scene's root group, traversable with fiber or three, so the site can interact with the demo (hover, menu items).
- **Styling props:** `demoContainerClass`, `settingContainerClass` and their `style` counterparts, appended and overriding internals, and `theme`, which lands as a data attribute the site's CSS keys on. The markup ships unstyled with stable class names; responsive defaults are settled with Izzy once.

## Two parts

- **The wrapper, `Demo` (`src/Demo/`)**, shared, built through the spec skill with its own tests: the container, the children as given, and the settings sidebar, keyboard-reachable, its inputs rendered from the schema with the input type and the accessibility attributes that follow each kind. The settings state comes from `useSettings(schema)`, which the demo calls and passes to both `Demo` and its scene, so the children stay plain JSX.
- **The demo, `src/<Name>/<Name>.demo.jsx`**, one per component: the scene Izzy specifies plus its schema, handed to `Demo`. Exported from the demos entry, `cocoon-ai/demos` (`src/demos.js`), never from the main entry.

## The schema

A plain object keyed by setting. `kind`: number, boolean, select, colour, vector. `default`, read from `cocoon.config.js` where one exists. `min`, `max`, `step` for numbers; `options` for a select. `live`: true when the value changes in place, false when the scene remounts. `when`: a setting and value that must hold for this one to show. `group`: material, lights, effects, and the component's own, for the sidebar to fold. The sidebar ends with a reset button that returns every setting to its default. Settings reach the scene as one object; a scene is a function of its settings and nothing else. An input the schema cannot describe is hand-written in the demo, and that is the exception, named in the report.

## Canvas scenes

- **Material:** a select, basic or standard; under standard, colour, roughness, metalness, emissive.
- **Map:** a select for where the component's texture goes, bump, color or alpha; alpha adds a background plane directly behind, with its own material settings.
- **Lights, under standard:** an environment select, the ten drei presets loaded from `@pmndrs/assets` (local to the install, never a CDN, loaded only when picked, through three's EXR loader and the PMREM path), the procedural room, and none; a directional light with on, intensity, colour and position. The demo adds the ambient and directional lights a standard material needs.
- **Effects:** a prop, not a spec question. The demos entry exports `EFFECTS`, an enum of integers, and a demo takes `effects`, an array of them in render order; each effect's settings join the schema under the effects group when it is on. On the WebGPU renderer the implementation is three's own post-processing, `RenderPipeline` (the class formerly named PostProcessing, deprecated as of r183) with the TSL display nodes; on the legacy renderer it is the pmndrs wrapper, which has no WebGPU support (verified 2026-10-07). An effect three lacks is ported singly, three's GLSL-to-TSL transpiler as the first draft, never the library.

## Tests

The demo page is the page the browser harness drives: one file for the demo and its browser test, and the test sets settings through the same schema the sidebar uses. The wrapper is tested with Testing Library: the sidebar toggles, by pointer and keyboard, and renders one input per schema entry with its attributes.

## The run

Inputs: the component, Izzy's spec of what the scene must contain, the effects list. Pre-flight: the demos entry exists in `package.json` and the build; a new dependency passes the vulnerability check first. Build: the scene, the schema, the test, the doc's demo section. The report evaluates the skill: what the schema could not say, what the wrapper lacked, what the site had to work around; a gap found in the run is fixed in the skill alongside the demo.
