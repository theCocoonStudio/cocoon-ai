import { describe, expect, it } from 'vitest'
import { simplifyPolyline } from './simplifyPolyline.js'

/** Distance from a point to a segment. */
function dist(p, a, b) {
  const sx = b[0] - a[0]
  const sy = b[1] - a[1]
  const L2 = sx * sx + sy * sy
  const t = L2
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sy) / L2))
    : 0
  return Math.hypot(p[0] - a[0] - t * sx, p[1] - a[1] - t * sy)
}

describe('simplifyPolyline', () => {
  it('returns the input untouched below three points', () => {
    const two = [
      [0, 0],
      [1, 1],
    ]
    expect(simplifyPolyline(two, 1)).toBe(two)
  })

  it('collapses collinear runs to their endpoints', () => {
    const line = Array.from({ length: 50 }, (_, i) => [i, 2 * i])
    expect(simplifyPolyline(line, 0.01)).toEqual([
      [0, 0],
      [49, 98],
    ])
  })

  it('keeps every corner that stands further than eps off the chord', () => {
    const zig = [
      [0, 0],
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
    ]
    expect(simplifyPolyline(zig, 0.5)).toEqual(zig)
    expect(simplifyPolyline(zig, 2)).toEqual([
      [0, 0],
      [4, 0],
    ])
  })

  it('leaves no dropped point further than eps from the simplified line', () => {
    const arc = Array.from({ length: 400 }, (_, i) => {
      const a = (i / 399) * Math.PI
      return [100 * Math.cos(a), 100 * Math.sin(a)]
    })
    const eps = 0.5
    const out = simplifyPolyline(arc, eps)
    expect(out.length).toBeLessThan(arc.length / 4)
    for (const p of arc) {
      let best = Infinity
      for (let i = 0; i + 1 < out.length; i++)
        best = Math.min(best, dist(p, out[i], out[i + 1]))
      expect(best).toBeLessThanOrEqual(eps + 1e-9)
    }
  })

  it('keeps the first point of a closed outline so the closing edge is implied', () => {
    const square = [
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    const out = simplifyPolyline(square, 0.1)
    expect(out[0]).toEqual([0, 0])
    expect(out).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ])
  })
})
