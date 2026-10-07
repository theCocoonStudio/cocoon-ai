import { Vector3 } from 'three'

// Scratch, shared and holding nothing between calls.
const forward = /* @__PURE__ */ new Vector3()
const right = /* @__PURE__ */ new Vector3()
const up = /* @__PURE__ */ new Vector3()

/**
 * Where a plane facing a perspective camera must sit, and how large, so that it
 * covers a rectangle of the viewport exactly, `distance` in front of the camera.
 * No scissor and no viewport change: the plane is placed in the world so the
 * camera's projection lands it on the rectangle. `rect` and `canvas` share one
 * unit and origin (CSS px, viewport coordinates, y down; the canvas is assumed
 * to fill the viewport, so its own origin is 0,0). The camera's `fov` is the
 * vertical one in degrees, `aspect` the canvas's; `position` and `quaternion`
 * are the camera's in world space.
 *
 * @param {{ rect: { x: number, y: number, width: number, height: number }, canvas: { width: number, height: number }, camera: { fov: number, aspect: number, position: Vector3, quaternion: import('three').Quaternion }, distance: number }} args
 * @param {{ position: Vector3, quaternion: import('three').Quaternion, scale: Vector3 }} out written in place; `scale` is the plane's width and height for a unit plane
 */
export function placeInView({ rect, canvas, camera, distance }, out) {
  const visibleHeight = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
  const visibleWidth = visibleHeight * camera.aspect
  const w = (rect.width / canvas.width) * visibleWidth
  const h = (rect.height / canvas.height) * visibleHeight
  const cx = ((rect.x + rect.width / 2) / canvas.width - 0.5) * visibleWidth
  const cy = (0.5 - (rect.y + rect.height / 2) / canvas.height) * visibleHeight
  forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
  right.set(1, 0, 0).applyQuaternion(camera.quaternion)
  up.set(0, 1, 0).applyQuaternion(camera.quaternion)
  out.position
    .copy(camera.position)
    .addScaledVector(forward, distance)
    .addScaledVector(right, cx)
    .addScaledVector(up, cy)
  out.quaternion.copy(camera.quaternion)
  out.scale.set(w, h, 1)
  return out
}
