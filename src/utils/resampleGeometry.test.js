import { describe, expect, it } from 'vitest'
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  Vector3,
} from 'three'
import { resampleGeometry } from './resampleGeometry.js'

function bruteNearest(pos, q) {
  let best = -1
  let bestDist = Infinity
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    const d = v.fromBufferAttribute(pos, i).distanceToSquared(q)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

describe('resampleGeometry', () => {
  it('returns attributes with the base vertex count', () => {
    const base = new BoxGeometry()
    const target = new SphereGeometry(1, 8, 6)
    const { position, normal } = resampleGeometry(base, target)
    expect(position.count).toBe(base.attributes.position.count)
    expect(normal.count).toBe(base.attributes.position.count)
  })

  it('picks the nearest target vertex for every base vertex (matches brute force)', () => {
    const base = new SphereGeometry(1.3, 12, 9)
    const target = new SphereGeometry(1, 16, 12)
    const { position } = resampleGeometry(base, target, { normals: false })
    const tp = target.attributes.position
    const q = new Vector3()
    const got = new Vector3()
    for (let i = 0; i < base.attributes.position.count; i++) {
      q.fromBufferAttribute(base.attributes.position, i)
      got.fromBufferAttribute(position, i)
      const j = bruteNearest(tp, q)
      expect(got.distanceToSquared(q)).toBeCloseTo(
        q.distanceToSquared(new Vector3().fromBufferAttribute(tp, j)),
        10,
      )
    }
  })

  it('works when the base lies outside the target bounding box', () => {
    const base = new BoxGeometry(10, 10, 10)
    const target = new SphereGeometry(1, 8, 6)
    const { position } = resampleGeometry(base, target, { normals: false })
    const q = new Vector3()
    const got = new Vector3()
    for (let i = 0; i < position.count; i++) {
      q.fromBufferAttribute(base.attributes.position, i)
      got.fromBufferAttribute(position, i)
      expect(got.length()).toBeCloseTo(1, 5)
      const j = bruteNearest(target.attributes.position, q)
      expect(got.distanceToSquared(q)).toBeCloseTo(
        q.distanceToSquared(
          new Vector3().fromBufferAttribute(target.attributes.position, j),
        ),
        10,
      )
    }
  })

  it('accepts a non-indexed base: one sample per vertex, in base order', () => {
    const base = new BoxGeometry().toNonIndexed() // 36 vertices, no index
    const target = new SphereGeometry(1, 8, 6)
    const { position, normal } = resampleGeometry(base, target)
    expect(base.index).toBeNull()
    expect(position.count).toBe(36)
    expect(normal.count).toBe(36)
    const tp = target.attributes.position
    const q = new Vector3()
    const got = new Vector3()
    for (let i = 0; i < 36; i++) {
      q.fromBufferAttribute(base.attributes.position, i)
      got.fromBufferAttribute(position, i)
      const j = bruteNearest(tp, q)
      expect(got.distanceToSquared(q)).toBeCloseTo(
        q.distanceToSquared(new Vector3().fromBufferAttribute(tp, j)),
        10,
      )
    }
  })

  it('gives the same result for an indexed and a non-indexed target', () => {
    const base = new BoxGeometry()
    const indexed = new SphereGeometry(1, 8, 6)
    const nonIndexed = indexed.clone().toNonIndexed()
    expect(nonIndexed.index).toBeNull()
    const a = resampleGeometry(base, indexed)
    const b = resampleGeometry(base, nonIndexed)
    expect(Array.from(b.position.array)).toEqual(Array.from(a.position.array))
    expect(Array.from(b.normal.array)).toEqual(Array.from(a.normal.array))
  })

  it('omits normals when asked', () => {
    const out = resampleGeometry(
      new BoxGeometry(),
      new SphereGeometry(1, 8, 6),
      { normals: false },
    )
    expect(out.normal).toBeUndefined()
  })

  it('computes target normals when the target has none, without mutating the target', () => {
    const target = new BufferGeometry()
    target.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    const { normal } = resampleGeometry(new BoxGeometry(), target)
    expect(normal.count).toBe(24)
    expect(Math.abs(normal.getZ(0))).toBeCloseTo(1, 5)
    expect(target.attributes.normal).toBeUndefined()
  })

  it('throws when a geometry has no position attribute', () => {
    expect(() =>
      resampleGeometry(new BufferGeometry(), new BoxGeometry()),
    ).toThrow(/base has no position/)
    expect(() =>
      resampleGeometry(new BoxGeometry(), new BufferGeometry()),
    ).toThrow(/target has no position/)
  })
})
