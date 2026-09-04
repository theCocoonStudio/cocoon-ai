import { describe, expect, it } from 'vitest'
import { BoxGeometry, BufferGeometry, SphereGeometry } from 'three'
import { decimateGeometry } from './decimateGeometry.js'

describe('decimateGeometry', () => {
  it('reduces to at most the requested count, indexed, shape kept near the unit sphere', () => {
    const sphere = new SphereGeometry(1, 16, 12)
    const before = sphere.attributes.position.count
    const out = decimateGeometry(sphere, 40)
    expect(out.index).not.toBeNull()
    expect(out.attributes.position.count).toBeLessThanOrEqual(40)
    expect(out.attributes.position.count).toBeGreaterThan(0)
    expect(sphere.attributes.position.count).toBe(before) // input untouched
    const p = out.attributes.position
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i), p.getZ(i))
      expect(r).toBeCloseTo(1, 5)
    }
  })

  it('returns a merged copy when already at or below the count', () => {
    const box = new BoxGeometry().toNonIndexed() // 36 vertices, 24 after merging
    const out = decimateGeometry(box, 24)
    expect(out.attributes.position.count).toBe(24)
    expect(out.index).not.toBeNull()
    expect(out).not.toBe(box)
  })

  it('recomputes normals when the input had them', () => {
    const out = decimateGeometry(new SphereGeometry(1, 16, 12), 40)
    expect(out.attributes.normal).toBeDefined()
    expect(out.attributes.normal.count).toBe(out.attributes.position.count)
  })

  it('throws on missing positions or a bad count', () => {
    expect(() => decimateGeometry(new BufferGeometry(), 10)).toThrow(
      /no position/,
    )
    expect(() => decimateGeometry(new BoxGeometry(), 0)).toThrow(
      /positive integer/,
    )
    expect(() => decimateGeometry(new BoxGeometry(), 2.5)).toThrow(
      /positive integer/,
    )
  })
})
