# MorphTargets — resolved

Built against `MorphTargets.spec.md` plus the entries below. Test names carry the spec ids; `contracts.*` at tier ② or ③ have tests too.

## contracts

contracts.1: the handle is read only after mount, from a `useFrame` or an effect — owner caller — tier ④ — `handle.mesh` and `handle.geometry` are null during render
contracts.2: the owner's Canvas runs `frameloop="always"`, or the owner calls `invalidate()` after writing influences — owner caller — tier ④ — under `demand`, influence changes show nothing
contracts.3: exactly one `<mesh>` among the children; the first Mesh found is the one wrapped — owner caller — tier ② for none (exits.throws), tier ④ for a second mesh, which is ignored
contracts.4: child targets are attached as `userData-target0`, `target1` ... with no gap — owner caller — tier ③ — the list stops at the gap and a dev warning names the ignored keys
contracts.5: an error boundary above the Canvas owns exits.throws — owner ancestor — tier ④ — without one the whole root unmounts
contracts.6: targets and the base are not mutated or disposed by the owner while mounted — owner caller — tier ④ — a rebuild reads whatever is there

## defaults

defaults.1: `process.env.NODE_ENV !== 'production'` gates effects.2 although the target is portable — it is the one bundler convention every consumer replaces; the Vite lib build leaves it in place (verified on this repo's build)
defaults.2: `match: 'lower'` decimates the base whatever `reduce` says — nearest-vertex resampling yields positions with no faces, so it cannot produce a renderable base
defaults.3: after `reduce: 'decimate'` the reduced target may sit one or two vertices under the count (edge collapse leaves unreferenced vertices that merging drops); the nearest-vertex fit tolerates that, and exits.throws fires on the target's input count instead
defaults.4: after handle.dispose, `morphTargetInfluences` and `morphTargetDictionary` are `undefined`, the state of a fresh Mesh, rather than `[]`
defaults.5: morph attributes are named `target0`, `target1` ... so `mesh.morphTargetDictionary` mirrors the attach keys
defaults.6: the handle is created once (empty deps) and exposes `mesh` and `geometry` as getters over refs, so it never goes stale
defaults.7: effects.1 depends on `children`, so it runs on every parent render and compares identities (base, each target, the three options); a rebuild happens only when one differs. A new `targets` array holding the same geometries does not rebuild
defaults.8: influences carry over by index on rebuild; a target added at the end starts at 0, a removed one is dropped
defaults.9: warning thresholds are module constants: 1,000,000 base vertices × targets, 100,000 vertices for any decimation

## notes

notes.1: SimplifyModifier keeps only position, normal, uv, tangent and color. A decimated target loses nothing that matters (only position and normal are sampled), but under `match: 'lower'` the base is decimated and loses any other attribute it carried
notes.2: `resampleGeometry` buckets the target into a uniform grid, about one vertex per cell, and searches outward in shells; the answer is exact and the cost is near linear
notes.3: a non-indexed target is merged before counting, so the count compared under `match` and `decimate` is the merged count, like the base's
notes.4: in `@react-three/test-renderer` fiber disposes declared geometries immediately on unmount, which is why `dispose.inputs` is assertable; in a browser fiber does the same at unmount, not at idle

## gaps

gaps.1: `states.*` on a scene component — the enumerated DOM states (disabled, pending, empty, error) do not apply, and the meaningful scene states here (lower, render-exit, disposed) had to be invented as ids
gaps.2: no field says which morph attributes a target contributes; it is folded into props.4 (`normals`) and markup.2
