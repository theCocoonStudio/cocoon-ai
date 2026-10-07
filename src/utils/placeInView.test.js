import { describe, expect, it } from 'vitest'
import { Group, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import { placeInView } from './placeInView.js'

const out = () => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  scale: new Vector3(),
})
const canvas = { width: 800, height: 600 }
const camera = () => {
  const c = new PerspectiveCamera(50, 800 / 600, 0.1, 100)
  c.position.set(0, 0, 5)
  return c
}
const visibleHeight = (d) => 2 * d * Math.tan((50 * Math.PI) / 360)
const place = (rect, cam, distance) =>
  placeInView({ rect, canvas, camera: cam, distance }, out())

describe('placeInView', () => {
  it('the whole canvas: a plane at the distance, centred on the view axis, as wide and tall as the view', () => {
    const o = place({ x: 0, y: 0, ...canvas }, camera(), 5)
    expect(o.position.toArray().map((v) => +v.toFixed(6))).toEqual([0, 0, 0])
    const h = visibleHeight(5)
    expect(o.scale.y).toBeCloseTo(h)
    expect(o.scale.x).toBeCloseTo(h * (800 / 600))
    expect(o.quaternion.equals(new Quaternion())).toBe(true)
  })

  it('a quarter at the top-left: half the width and height, its centre up and left of the axis', () => {
    const o = place({ x: 0, y: 0, width: 400, height: 300 }, camera(), 5)
    const h = visibleHeight(5)
    const w = h * (800 / 600)
    expect(o.scale.x).toBeCloseTo(w / 2)
    expect(o.scale.y).toBeCloseTo(h / 2)
    expect(o.position.x).toBeCloseTo(-w / 4)
    expect(o.position.y).toBeCloseTo(h / 4)
    expect(o.position.z).toBeCloseTo(0)
  })

  it('scales with the distance: twice as far, twice as large, the same on screen', () => {
    const rect = { x: 100, y: 50, width: 200, height: 100 }
    const near = place(rect, camera(), 1)
    const far = place(rect, camera(), 2)
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
    const o = place({ x: 400, y: 0, width: 400, height: 300 }, c, 5)
    const h = visibleHeight(5)
    const w = h * (800 / 600)
    // from (0, 0, 5): forward is -x, right is -z, up is +y
    expect(o.position.x).toBeCloseTo(-5)
    expect(o.position.z).toBeCloseTo(5 - w / 4)
    expect(o.position.y).toBeCloseTo(h / 4)
    expect(o.quaternion.angleTo(c.quaternion)).toBeCloseTo(0)
  })

  it("a parented camera: the parent's transform is in the result, since the world matrix is used", () => {
    const c = camera()
    const rig = new Group()
    rig.position.set(10, 0, 0)
    rig.add(c)
    const o = place({ x: 0, y: 0, ...canvas }, c, 5)
    expect(o.position.x).toBeCloseTo(10)
    expect(o.position.z).toBeCloseTo(0)
  })

  it('a camera moved since the last frame is read where it is now, not where it was', () => {
    const c = camera()
    c.updateMatrixWorld()
    c.position.set(0, 3, 5)
    const o = place({ x: 0, y: 0, ...canvas }, c, 5)
    expect(o.position.y).toBeCloseTo(3)
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
