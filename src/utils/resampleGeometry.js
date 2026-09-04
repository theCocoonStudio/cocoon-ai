import { Float32BufferAttribute, Vector3 } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Fit `target` to `base` vertex by vertex: for every vertex of `base`, take the
 * nearest vertex of `target`. The result has exactly `base`'s vertex count and
 * order, so it can be used directly as a morph attribute of `base`.
 *
 * Nearest-neighbour search runs over a uniform grid built from `target`, so the
 * cost is close to linear in the two vertex counts rather than their product.
 *
 * Neither input is mutated. When `normals` is set and `target` has no normal
 * attribute, normals are computed on a merged copy of `target`.
 *
 * @param {import('three').BufferGeometry} base   geometry whose vertices are kept
 * @param {import('three').BufferGeometry} target geometry to sample from
 * @param {{ normals?: boolean }} [options]        `normals` (default true): also return a normal attribute
 * @returns {{ position: Float32BufferAttribute, normal?: Float32BufferAttribute }}
 *   attributes of `base`'s length, holding `target`'s positions (and normals)
 * @throws {Error} when either geometry has no position attribute or no vertices
 */
export function resampleGeometry(base, target, { normals = true } = {}) {
  const basePos = base?.attributes?.position
  const targetPos = target?.attributes?.position
  if (!basePos || basePos.count === 0)
    throw new Error('resampleGeometry: base has no position attribute')
  if (!targetPos || targetPos.count === 0)
    throw new Error('resampleGeometry: target has no position attribute')

  let targetNormal = normals ? target.attributes.normal : undefined
  let sampled = target
  if (normals && !targetNormal) {
    sampled = mergeVertices(target)
    sampled.computeVertexNormals()
    targetNormal = sampled.attributes.normal
  }
  const sampledPos = sampled.attributes.position

  const grid = buildGrid(sampledPos)
  const position = new Float32BufferAttribute(basePos.count * 3, 3)
  const normal = normals
    ? new Float32BufferAttribute(basePos.count * 3, 3)
    : undefined

  const query = new Vector3()
  for (let i = 0; i < basePos.count; i++) {
    query.fromBufferAttribute(basePos, i)
    const j = nearest(grid, sampledPos, query)
    position.setXYZ(
      i,
      sampledPos.getX(j),
      sampledPos.getY(j),
      sampledPos.getZ(j),
    )
    if (normal)
      normal.setXYZ(
        i,
        targetNormal.getX(j),
        targetNormal.getY(j),
        targetNormal.getZ(j),
      )
  }

  return normal ? { position, normal } : { position }
}

// A uniform grid over the target's bounding box, roughly one vertex per cell.
function buildGrid(pos) {
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    min.min(v)
    max.max(v)
  }
  const extent = max.clone().sub(min)
  const longest = Math.max(extent.x, extent.y, extent.z) || 1
  const cell = longest / Math.max(1, Math.cbrt(pos.count))
  const dims = [
    Math.max(1, Math.ceil(extent.x / cell) + 1),
    Math.max(1, Math.ceil(extent.y / cell) + 1),
    Math.max(1, Math.ceil(extent.z / cell) + 1),
  ]
  const cells = new Map()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const key = cellKey(
      dims,
      cellOf(v.x, min.x, cell),
      cellOf(v.y, min.y, cell),
      cellOf(v.z, min.z, cell),
    )
    let bucket = cells.get(key)
    if (!bucket) cells.set(key, (bucket = []))
    bucket.push(i)
  }
  return { min, cell, dims, cells }
}

function cellOf(x, min, cell) {
  return Math.floor((x - min) / cell)
}

function cellKey(dims, x, y, z) {
  return (x * dims[1] + y) * dims[2] + z
}

// Search shells of cells outward from the query's cell. After shell r, every
// unvisited vertex is at least r × cell away, so once the best distance is
// within that bound the answer is exact.
function nearest(grid, pos, q) {
  const { min, cell, dims, cells } = grid
  const cx = cellOf(q.x, min.x, cell)
  const cy = cellOf(q.y, min.y, cell)
  const cz = cellOf(q.z, min.z, cell)
  const maxShell =
    Math.max(dims[0], dims[1], dims[2]) +
    Math.max(Math.abs(cx), Math.abs(cy), Math.abs(cz)) +
    1
  let best = -1
  let bestDist = Infinity
  for (let r = 0; r <= maxShell; r++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= dims[0]) continue
      for (let y = cy - r; y <= cy + r; y++) {
        if (y < 0 || y >= dims[1]) continue
        for (let z = cz - r; z <= cz + r; z++) {
          if (z < 0 || z >= dims[2]) continue
          // Only the shell surface: interior cells were visited in earlier rounds.
          if (
            Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== r
          )
            continue
          const bucket = cells.get(cellKey(dims, x, y, z))
          if (!bucket) continue
          for (const j of bucket) {
            const dx = pos.getX(j) - q.x
            const dy = pos.getY(j) - q.y
            const dz = pos.getZ(j) - q.z
            const d = dx * dx + dy * dy + dz * dz
            if (d < bestDist) {
              bestDist = d
              best = j
            }
          }
        }
      }
    }
    if (best !== -1 && Math.sqrt(bestDist) <= r * cell) break
  }
  return best
}
