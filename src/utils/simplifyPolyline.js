/**
 * Ramer–Douglas–Peucker simplification of a polyline.
 *
 * Keeps the endpoints, then keeps the point furthest from the chord between
 * two kept points whenever it lies further than `eps` off it, recursively,
 * so every dropped point sits within `eps` of the simplified line. For a
 * closed outline pass the points without repeating the first; the first
 * point is always kept and the closing edge is implied.
 *
 * The wordmark is cut from the font with this, at 0.05 design units, and the
 * logo mesh simplifies its outlines with it again at mount, to the chord
 * error a chosen pixel size allows. One pass, iterative, no allocation
 * beyond the keep list.
 *
 * @param {number[][]} pts [x, y] points, in order
 * @param {number} [eps=0.05] largest distance a dropped point may sit from the result, in the points' units
 * @returns {number[][]} the kept points, in order; the input array when it has fewer than three points
 */
export function simplifyPolyline(pts, eps = 0.05) {
  const n = pts.length
  if (n < 3) return pts
  const keep = new Array(n).fill(false)
  keep[0] = keep[n - 1] = true
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()
    if (j <= i + 1) continue
    const p = pts[i]
    const q = pts[j]
    const sx = q[0] - p[0]
    const sy = q[1] - p[1]
    const L = Math.sqrt(sx * sx + sy * sy)
    let k = -1
    let best = -1
    for (let m = i + 1; m < j; m++) {
      const vx = pts[m][0] - p[0]
      const vy = pts[m][1] - p[1]
      const d =
        L < 1e-12
          ? Math.sqrt(vx * vx + vy * vy)
          : Math.abs(sx * vy - sy * vx) / L
      if (d > best) {
        best = d
        k = m
      }
    }
    if (best > eps) {
      keep[k] = true
      stack.push([i, k])
      stack.push([k, j])
    }
  }
  return pts.filter((_, i) => keep[i])
}
