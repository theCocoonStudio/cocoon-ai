# CocoonLogoGroup — resolved

Built against `CocoonLogoGroup.spec.md` plus the entries below. Test names carry the spec ids; `contracts.*` at tier ② or ③ have tests too.

## contracts

contracts.1: the default lockup builds in under 20 ms on mount — owner none, this component — tier ④ with a test: the median of five builds in `CocoonLogoGroup.test.jsx`; the cold first build in Node is about 33 ms, the JIT warming on the extrusion, and is not what the budget is for
contracts.2: the handle is read after mount, from a `useFrame` or an effect — owner caller — tier ④ — every member is null during render
contracts.3: an error boundary above the Canvas owns exits.throws — owner ancestor — tier ④ — without one the whole root unmounts
contracts.4: `geometryProps.dispose === null` means the owner disposes the geometries, on unmount and after every rebuild — owner caller — tier ④ — the handle's `geometry` members are how it reaches them; a rebuild it does not notice leaks the replaced set
contracts.5: `extrudeOptions` that widen the bevel past half the thinnest feature (the wordmark stem is 71.1 of 3128 units, the weave gap 45) self-intersect the inset contour — owner caller — tier ④ — the default is a tenth of that
contracts.6: the Canvas runs `frameloop="always"`, or the owner invalidates after moving the group — owner caller — tier ④ — nothing here moves, so nothing here invalidates

## defaults

defaults.1: `scene.planes` of 1 is accepted, the engine's convention (`assets/lib/haze.js` `tone()`), and draws the surface colour alone, although `hazeResolve` refuses fewer than two planes; the colours are still validated through it
defaults.2: the `scene` and `extrudeOptions` objects enter `useMemo` through their JSON, so a fresh object with the same numbers does not rebuild; an identity dependency would rebuild 21,000 vertices on every parent render
defaults.3: each geometry is normalised and centred on the _simplified_ outline, so the mesh is exactly its own ink; the layout measured the dense outline, and the two differ by at most `eps` px at `maxSize`, which is why the ink width test allows that much
defaults.4: the geometry is a `<primitive>` from `useMemo`, not `<extrudeGeometry args>`: it is translated to its centre after construction and JSX gives no moment for that. Fiber 9.7.0 does dispose a JSX geometry replaced by an args change (`events-*.cjs.dev.js`, the reconstruct branch: `if (instance.type !== 'primitive') disposeOnIdle(instance.object)`), verified with a spy in the test renderer, and never a primitive; so this component disposes on both moments, in an effect keyed on the built set
defaults.5: the wordmark's five contours become one geometry of five shapes sharing one frame, and the o's counter is a hole of its outer contour, decided at generation by containment (`assets/logo/build.js`)
defaults.6: `toneMapped: false` on the basic material only; the standard material keeps three's default, since a lit material is already a departure from the flat logo
defaults.7: bevel radius 0.3 of one triangle's depth, 3 segments, inset by `bevelOffset = -bevelSize`: the silhouette is the artwork's and the flat cap is inset by the radius, so the cap, not the silhouette, is what a flat drawing of the mesh shows; the fidelity test draws with the bevel off for that reason
defaults.8: the lockup gap follows `assets/logo/export.js`: the worst trail over the shipped sizes and the given `size`, so the default lockup is the shipped file and a larger icon pushes the gap up
defaults.9: `angle` follows the CSS convention the scene states, 0 right and 90 down, so with y up the offset's y is negated

## notes

notes.1: a `meshStandardMaterialProps` object and `materialProps` both spread onto the standard material, the latter last, so one prop set is enough for either material; the boolean-or-object shape is Izzy's, kept as asked
notes.2: the ink's bounding box, not the front triangle, is the origin, as decided on 2026-09-13; the logo spec's §6.8 anchors centring assets on the front triangle. In the icon view the owner offsets by the difference if the nav must follow §6.8
notes.3: a `<mesh>` with `scale={number}` is uniform in fiber; the bevel stays round because of it
notes.4: under React StrictMode in development, `useMemo` runs its function twice on mount and discards the first result, so the first set of geometries is never disposed; a development-only cost of one build, about 21,000 vertices, per mount. Izzy plans a memory profiler; this is the first thing it should see
notes.5: the fidelity test rasterises the mesh's front caps as SVG polygons over the shipped lockup's own viewBox and differs from the shipped raster in under 1% of pixels at 800 px, edge antialiasing included; measured 0.13% with the bevel off

## gaps

gaps.1: `library.helper`, `library.generated` and `library.script` are not fields of the skill's model; the spec needed a home for the pure builder the script shares, the generated data module and the export script, and the report proposes them
gaps.2: no field expresses a performance budget; contracts.1 is written as a contract with a test because that is the nearest shape
gaps.3: `states.*` on a scene component, as MorphTargets found: the DOM states do not apply and `states.icon`, `states.standard` are invented ids
