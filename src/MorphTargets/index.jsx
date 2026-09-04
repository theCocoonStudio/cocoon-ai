import { useEffect, useImperativeHandle, useRef } from 'react'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { resampleGeometry } from '../utils/resampleGeometry.js'
import { decimateGeometry } from '../utils/decimateGeometry.js'

/**
 * @typedef {import('three').BufferGeometry} BufferGeometry
 * @typedef {import('three').Mesh} Mesh
 */

/**
 * @typedef {object} MorphTargetsHandle
 * @property {Mesh | null} mesh              the wrapped mesh; null before mount
 * @property {BufferGeometry | null} geometry the merged geometry on the mesh; null before mount and after dispose()
 * @property {(index: number, value: number) => void} set
 *   writes mesh.morphTargetInfluences[index], clamped to 0–1; no-op before mount, after dispose(), or for an index without a target
 * @property {() => void} dispose
 *   releases the merged geometry, puts the base back on the mesh, clears influences; idempotent;
 *   the component stays inert until a prop or child changes, which rebuilds
 */

/**
 * @typedef {object} MorphTargetsProps
 * @property {import('react').ReactNode} children   exactly one <mesh>; its declared geometry is the base;
 *   targets go inside it as `<primitive object={geometry} attach="userData-target0" />`, target1, target2 ...
 * @property {BufferGeometry[]} [targets]           the alternative to child targets; ignored when child targets exist
 * @property {'resample' | 'decimate'} [reduce='resample']
 *   how a target is fitted to the base count: nearest vertex per base vertex, or edge-collapse first and then nearest
 * @property {'base' | 'lower'} [match='base']
 *   'base' keeps the base as authored; 'lower' decimates the base down to the smallest target when a target has fewer vertices
 * @property {boolean} [normals=true]               also build a normal morph attribute per target
 * @property {'throw' | 'render'} [exit='throw']    on a bad input: throw to the nearest error boundary, or leave the mesh untouched
 * @property {import('react').Ref<MorphTargetsHandle>} [ref]
 */

const DEV = process.env.NODE_ENV !== 'production'
const WARN_VERTEX_TARGETS = 1_000_000
const WARN_DECIMATE_VERTICES = 100_000

function findTargets(mesh, targets) {
  const found = []
  for (let i = 0; ; i++) {
    const g = mesh.userData[`target${i}`]
    if (!g?.isBufferGeometry) break
    found.push(g)
  }
  if (DEV) {
    const stray = Object.keys(mesh.userData).filter(
      (key) => /^target\d+$/.test(key) && Number(key.slice(6)) >= found.length,
    )
    if (stray.length > 0)
      warn(
        `child targets must be contiguous from target0; ignoring ${stray.join(', ')}`,
      )
  }
  if (found.length > 0) return found
  return Array.isArray(targets) ? targets : []
}

function sameList(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function vertexCount(g) {
  return g.attributes.position.count
}

function warn(message) {
  if (DEV) console.warn(`MorphTargets: ${message}`)
}

/**
 * Build the merged geometry: a private, indexed copy of `base` carrying one
 * morph attribute per target. Throws on inputs the morph cannot be built from.
 */
function build(base, targets, { reduce, match, normals }) {
  if (!base?.attributes?.position)
    throw new Error('MorphTargets: base geometry has no position attribute')
  for (const t of targets) {
    if (!t?.attributes?.position)
      throw new Error(
        'MorphTargets: a target geometry has no position attribute',
      )
  }

  // Own buffers, indexed. clone() deep-copies attributes; mergeVertices builds new ones.
  let merged = base.index ? base.clone() : mergeVertices(base)
  merged.morphAttributes = {}
  let count = vertexCount(merged)

  // Indexed targets are counted as they are; non-indexed ones after merging.
  const prepared = targets.map((t) => (t.index ? t : mergeVertices(t)))

  if (match === 'lower') {
    const lowest = Math.min(count, ...prepared.map(vertexCount))
    if (lowest < count) {
      if (DEV && count > WARN_DECIMATE_VERTICES)
        warn(
          `decimating the base geometry (${count} vertices); this can take seconds`,
        )
      merged = decimateGeometry(merged, lowest)
      count = vertexCount(merged)
    }
  }

  if (DEV && count * prepared.length > WARN_VERTEX_TARGETS) {
    warn(
      `${count} vertices × ${prepared.length} targets; the morph texture will be large`,
    )
  }

  const positions = []
  const normalAttrs = []
  prepared.forEach((target, i) => {
    let source = target
    if (reduce === 'decimate') {
      const have = vertexCount(target)
      if (have < count) {
        throw new Error(
          `MorphTargets: target ${i} has ${have} vertices, fewer than the ${count} it must match; decimate cannot add vertices`,
        )
      }
      if (DEV && have > WARN_DECIMATE_VERTICES)
        warn(`decimating target ${i} (${have} vertices); this can take seconds`)
      // Edge collapse can land a vertex or two under `count`; the nearest-vertex fit below tolerates that.
      source = decimateGeometry(target, count)
    }
    const fitted = resampleGeometry(merged, source, { normals })
    fitted.position.name = `target${i}`
    positions.push(fitted.position)
    if (normals) {
      fitted.normal.name = `target${i}`
      normalAttrs.push(fitted.normal)
    }
  })

  merged.morphAttributes.position = positions
  if (normals) merged.morphAttributes.normal = normalAttrs
  return merged
}

/**
 * Wraps one mesh and turns further geometries into its morph targets. The mesh
 * keeps its declared geometry as the base; every target is fitted to the base's
 * vertex count so `mesh.morphTargetInfluences[i]` blends toward target i.
 * Nothing runs per frame: the owner drives the influences through the handle
 * or the mesh directly.
 *
 * @param {MorphTargetsProps} props
 */
export function MorphTargets({
  children,
  targets,
  reduce = 'resample',
  match = 'base',
  normals = true,
  exit = 'throw',
  ref,
}) {
  const groupRef = useRef(null)
  const meshRef = useRef(null)
  const baseRef = useRef(null) // the mesh's geometry as declared
  const mergedRef = useRef(null) // what we put on the mesh
  const lastRef = useRef(null) // inputs the current merged geometry was built from
  const disposedRef = useRef(false)

  function teardown() {
    const mesh = meshRef.current
    const merged = mergedRef.current
    if (!merged) return
    if (mesh && mesh.geometry === merged) {
      mesh.geometry = baseRef.current
      mesh.morphTargetInfluences = undefined
      mesh.morphTargetDictionary = undefined
    }
    merged.dispose()
    mergedRef.current = null
  }

  useEffect(() => {
    const group = groupRef.current
    const mesh = group?.children.find((child) => child.isMesh) ?? null
    meshRef.current = mesh

    const fail = (message) => {
      if (exit === 'throw') throw new Error(`MorphTargets: ${message}`)
    }

    if (!mesh) return fail('child is not a mesh')

    const merged = mergedRef.current
    const base =
      merged && mesh.geometry === merged ? baseRef.current : mesh.geometry
    const found = findTargets(mesh, targets)
    if (found.length === 0)
      return fail('no target geometry found among the children or in `targets`')

    const last = lastRef.current
    const unchanged =
      last &&
      last.base === base &&
      sameList(last.targets, found) &&
      last.reduce === reduce &&
      last.match === match &&
      last.normals === normals
    if (unchanged && (merged || disposedRef.current)) return

    let next
    try {
      next = build(base, found, { reduce, match, normals })
    } catch (error) {
      if (exit === 'throw') throw error
      return
    }

    const previous = mergedRef.current
    const influences = mesh.morphTargetInfluences
    mesh.geometry = next
    mesh.updateMorphTargets()
    if (influences && previous) {
      const n = Math.min(influences.length, mesh.morphTargetInfluences.length)
      for (let i = 0; i < n; i++) mesh.morphTargetInfluences[i] = influences[i]
    }
    baseRef.current = base
    mergedRef.current = next
    lastRef.current = { base, targets: found, reduce, match, normals }
    disposedRef.current = false
    if (previous) previous.dispose()
    // Effect deps are the declared inputs; `children` covers a changed base or target under the mesh.
  }, [children, targets, reduce, match, normals, exit])

  useEffect(() => teardown, [])

  useImperativeHandle(
    ref,
    () => ({
      get mesh() {
        return meshRef.current
      },
      get geometry() {
        return mergedRef.current
      },
      set(index, value) {
        const mesh = meshRef.current
        const influences = mesh?.morphTargetInfluences
        if (
          !mergedRef.current ||
          !influences ||
          index < 0 ||
          index >= influences.length
        )
          return
        influences[index] = Math.min(1, Math.max(0, value))
      },
      dispose() {
        if (!mergedRef.current) return
        teardown()
        disposedRef.current = true
      },
    }),
    [],
  )

  return <group ref={groupRef}>{children}</group>
}
