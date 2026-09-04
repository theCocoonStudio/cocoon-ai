import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js'

const modifier = new SimplifyModifier()

/**
 * Reduce `geometry` to at most `count` vertices by edge collapse
 * (three's SimplifyModifier, Melax's progressive mesh algorithm), keeping the
 * overall shape. The input is not mutated.
 *
 * The result is always indexed. Duplicate vertices are merged first, so a
 * non-indexed input is counted after merging. When the merged geometry already
 * has `count` vertices or fewer it is returned as is, which means the result can
 * have fewer vertices than `count`; callers that need an exact count check
 * `result.attributes.position.count`.
 *
 * Attributes other than position, normal, uv, tangent and color are dropped, a
 * limit of SimplifyModifier. Normals are recomputed when the input had them.
 *
 * Cost grows quickly with vertex count; expect seconds above ~100k vertices.
 *
 * @param {import('three').BufferGeometry} geometry
 * @param {number} count  vertex count to reduce to
 * @returns {import('three').BufferGeometry} a new, indexed geometry
 * @throws {Error} when `geometry` has no position attribute or `count` is not a positive integer
 */
export function decimateGeometry(geometry, count) {
  if (
    !geometry?.attributes?.position ||
    geometry.attributes.position.count === 0
  )
    throw new Error('decimateGeometry: geometry has no position attribute')
  if (!Number.isInteger(count) || count < 1)
    throw new Error(
      `decimateGeometry: count must be a positive integer, got ${count}`,
    )

  const merged = mergeVertices(geometry)
  const have = merged.attributes.position.count
  if (have <= count) return merged

  const hadNormals = Boolean(merged.attributes.normal)
  const simplified = modifier.modify(merged, have - count) // non-indexed
  const result = mergeVertices(simplified)
  if (hadNormals) result.computeVertexNormals()
  return result
}
