# MorphTargets

Wraps one mesh and turns further geometries into its morph targets. The mesh keeps its declared geometry as the base. Every target is fitted to the base's vertex count, so `mesh.morphTargetInfluences[i]` blends the mesh toward target `i`. Nothing runs per frame: the owner drives the influences.

```jsx
import { useFrame } from '@react-three/fiber'
import { MorphTargets } from 'cocoon-ai'

function Blob({ scroll, scanned }) {
  const morph = useRef(null)
  useFrame(() => {
    morph.current?.set(0, scroll.current) // handle is null until mounted
  })
  return (
    <MorphTargets ref={morph}>
      <mesh>
        <sphereGeometry args={[1, 32, 24]} />
        <primitive object={scanned} attach='userData-target0' />
        <meshStandardMaterial />
      </mesh>
    </MorphTargets>
  )
}
```

## Inputs

**Children.** Exactly one `<mesh>`. Its declared geometry is the base. Targets go inside the mesh as `<primitive object={geometry} attach='userData-target0' />`, then `target1`, `target2` ..., contiguous from 0. A gap ends the list and, in development, logs a warning naming the ignored keys.

**Props.**

| Prop      | Type                       | Default      | Meaning                                                                                                                                                                                                                                                                                                                                                 |
| --------- | -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targets` | `BufferGeometry[]`         | none         | Targets, when the mesh carries none as children. Ignored when child targets exist.                                                                                                                                                                                                                                                                      |
| `reduce`  | `'resample' \| 'decimate'` | `'resample'` | How a target is fitted to the base count. `resample`: for every base vertex, take the nearest target vertex. Exact and cheap; a target much denser than the base gets sparse. `decimate`: edge-collapse the target down to the base count first (three's SimplifyModifier), then take nearest vertices. Keeps the target's shape; slow on large meshes. |
| `match`   | `'base' \| 'lower'`        | `'base'`     | `base`: the base stays as authored. `lower`: when a target has fewer vertices than the base, the base is decimated down to it and renders reduced.                                                                                                                                                                                                      |
| `normals` | `boolean`                  | `true`       | Also build a normal morph attribute per target, so shading follows the morph. Target normals are computed when the target has none.                                                                                                                                                                                                                     |
| `exit`    | `'throw' \| 'render'`      | `'throw'`    | On a bad input (see below): throw to the nearest error boundary, or leave the mesh exactly as declared.                                                                                                                                                                                                                                                 |
| `ref`     | `Ref<MorphTargetsHandle>`  |              | The handle.                                                                                                                                                                                                                                                                                                                                             |

Indexed and non-indexed geometries are both accepted. The output is always indexed. A non-indexed base has its duplicate vertices merged first, and that merged count is what targets are fitted to.

**Bad inputs** (throw by default): the child is not a mesh; no target in the children or in `targets`; a geometry without a position attribute; `reduce: 'decimate'` with a target that has fewer vertices than the count it must reach, since decimation cannot add vertices. Under `match: 'base'`, `resample` handles a smaller target fine.

## Output

After mount, `mesh.geometry` is a merged geometry: a private, indexed copy of the base with `morphAttributes.position[i]` (and `.normal[i]` when `normals`) per target. `mesh.morphTargetInfluences` has one 0 per target and `mesh.morphTargetDictionary` maps `target0`, `target1` ... to indices.

The merged geometry owns its buffers. Nothing is shared with the base, so disposing it never touches the base's GPU buffers.

## Handle

| Member              | Meaning                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mesh`              | The wrapped `Mesh`. `null` before mount.                                                                                                                                  |
| `geometry`          | The merged geometry on the mesh. `null` before mount and after `dispose()`.                                                                                               |
| `set(index, value)` | Writes `mesh.morphTargetInfluences[index]`, clamped to 0–1. No-op before mount, after `dispose()`, or for an index without a target.                                      |
| `dispose()`         | Releases the merged geometry, puts the base back on the mesh, clears the influences. Idempotent. The component stays inert until a prop or child changes, which rebuilds. |

The handle is populated after mount. Read it inside `useFrame` or an effect, never during render. This package deliberately exposes the lowest-level actions; wrap them in your own driver.

## Rebuilds

Geometry changes are declarative. The morph is rebuilt whenever the base geometry, the target list (identity or count), `reduce`, `match` or `normals` changes. The previous merged geometry is disposed after the new one is on the mesh. Influences carry over by index. An unrelated re-render does nothing.

## Dispose rules

- **The component disposes only what it creates**: the merged geometry, on rebuild (the old one), on unmount, and on `handle.dispose()`.
- **Inputs are never disposed by the component.** The base is a declared child, so fiber disposes it on unmount. A `primitive` or a geometry passed through `targets` belongs to whoever created it.
- **After `handle.dispose()`** the mesh renders its base geometry with no morph targets, `handle.geometry` is `null` and `set()` is a no-op. Nothing rebuilds until an input changes.

## Limits

Per target, with `b` base vertices and `t` target vertices:

- `resample` is near linear in `b + t` (grid-bucketed nearest-neighbour search).
- `decimate` grows fast with `t`; expect seconds above ~100k vertices.
- Memory: one attribute of `b` vertices per target, two with `normals`. Three packs every morph attribute into one texture, so GPU cost is `b × targets`.

In development the component warns once per build when `b × targets` exceeds 1,000,000, or when decimating anything above 100,000 vertices. The warnings are absent in production builds.

## Utilities

`src/utils/resampleGeometry.js` and `src/utils/decimateGeometry.js` are plain functions with no React, used by this component and unit-tested on their own. They are not exported from the package.
