/**
 * Where a plane facing a perspective camera must sit, and how large, so that it
 * covers a rectangle of the viewport exactly, `distance` in front of the camera.
 * No scissor and no viewport change: the plane is placed in the world so the
 * camera's projection lands it on the rectangle. `rect` and `canvas` share one
 * unit and origin (CSS px, viewport coordinates, y down; the canvas is assumed
 * to fill the viewport, so its own origin is 0,0). The camera is three's: its
 * vertical `fov` in degrees and `aspect` give the visible size at the distance,
 * and its world matrix, updated here first, carries the offset into the world,
 * so a parented or a moving camera needs nothing else (Izzy's review of #67).
 *
 * @param {{ rect: { x: number, y: number, width: number, height: number }, canvas: { width: number, height: number }, camera: import('three').PerspectiveCamera, distance: number }} args
 * @param {{ position: import('three').Vector3, quaternion: import('three').Quaternion, scale: import('three').Vector3 }} out written in place; `scale` is the plane's width and height for a unit plane
 */
export function placeInView({ rect, canvas, camera, distance }, out) {
  const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360)
  const width = height * camera.aspect
  const cx = ((rect.x + rect.width / 2) / canvas.width - 0.5) * width
  const cy = (0.5 - (rect.y + rect.height / 2) / canvas.height) * height
  camera.updateMatrixWorld()
  camera.localToWorld(out.position.set(cx, cy, -distance))
  camera.getWorldQuaternion(out.quaternion)
  out.scale.set(
    (rect.width / canvas.width) * width,
    (rect.height / canvas.height) * height,
    1,
  )
  return out
}
