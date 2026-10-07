import { describe, expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { placeInView } from './placeInView.js'

const out = () => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  scale: new Vector3(),
})
const canvas = { width: 800, height: 600 }
const camera = () => ({
  fov: 50,
  aspect: 800 / 600,
  position: new Vector3(0, 0, 5),
  quaternion: new Quaternion(),
})
const visibleHeight = (d) => 2 * d * Math.tan((50 * Math.PI) / 360)

describe('placeInView', () => {
  it('the whole canvas: a plane at the distance, centred on the view axis, as wide and tall as the view', () => {
    const o = placeInView(
      {
        rect: { x: 0, y: 0, ...canvas },
        canvas,
        camera: camera(),
        distance: 5,
      },
      out(),
    )
    expect(o.position.toArray()).toEqual([0, 0, 0])
    const h = visibleHeight(5)
    expect(o.scale.y).toBeCloseTo(h)
    expect(o.scale.x).toBeCloseTo(h * (800 / 600))
    expect(o.quaternion.equals(new Quaternion())).toBe(true)
  })

  it('a quarter at the top-left: half the width and height, its centre up and left of the axis', () => {
    const o = placeInView(
      {
        rect: { x: 0, y: 0, width: 400, height: 300 },
        canvas,
        camera: camera(),
        distance: 5,
      },
      out(),
    )
    const h = visibleHeight(5)
    const w = h * (800 / 600)
    expect(o.scale.x).toBeCloseTo(w / 2)
    expect(o.scale.y).toBeCloseTo(h / 2)
    expect(o.position.x).toBeCloseTo(-w / 4)
    expect(o.position.y).toBeCloseTo(h / 4)
    expect(o.position.z).toBeCloseTo(0)
  })

  it('scales with the distance: twice as far, twice as large, the same on screen', () => {
    const near = placeInView(
      {
        rect: { x: 100, y: 50, width: 200, height: 100 },
        canvas,
        camera: camera(),
        distance: 1,
      },
      out(),
    )
    const far = placeInView(
      {
        rect: { x: 100, y: 50, width: 200, height: 100 },
        canvas,
        camera: camera(),
        distance: 2,
      },
      out(),
    )
    expect(far.scale.x).toBeCloseTo(near.scale.x * 2)
    expect(far.scale.y).toBeCloseTo(near.scale.y * 2)
    const dn = near.position.clone().sub(camera().position)
    const df = far.position.clone().sub(camera().position)
    expect(df.x).toBeCloseTo(dn.x * 2)
    expect(df.y).toBeCloseTo(dn.y * 2)
    expect(df.z).toBeCloseTo(dn.z * 2)
  })

  it('follows a turned camera: the plane sits along its view axis, offset along its right and up, and faces it', () => {
    const c = camera()
    c.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2) // looking down -x
    const o = placeInView(
      {
        rect: { x: 400, y: 0, width: 400, height: 300 },
        canvas,
        camera: c,
        distance: 5,
      },
      out(),
    )
    const h = visibleHeight(5)
    const w = h * (800 / 600)
    // from (0, 0, 5): forward is -x, right is -z, up is +y
    expect(o.position.x).toBeCloseTo(-5)
    expect(o.position.z).toBeCloseTo(5 - w / 4)
    expect(o.position.y).toBeCloseTo(h / 4)
    expect(o.quaternion.equals(c.quaternion)).toBe(true)
  })

  it('writes in place and returns the same object; a second call with another rect overwrites', () => {
    const o = out()
    const r = placeInView(
      {
        rect: { x: 0, y: 0, ...canvas },
        canvas,
        camera: camera(),
        distance: 5,
      },
      o,
    )
    expect(r).toBe(o)
    placeInView(
      {
        rect: { x: 400, y: 300, width: 400, height: 300 },
        canvas,
        camera: camera(),
        distance: 5,
      },
      o,
    )
    expect(o.position.x).toBeGreaterThan(0)
    expect(o.position.y).toBeLessThan(0)
  })
})
