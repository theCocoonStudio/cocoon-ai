import {
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  RawShaderMaterial,
} from 'three'
import lineVert from './glsl/line.vert?raw'
import lineFrag from './glsl/boundary.frag?raw'

/**
 * The wall: four line segments one cell inside the edge that write zero
 * velocity on the rim. A pass that adds it as a child draws it after its
 * quad, so the rim ends the pass at rest. The last pass that writes velocity
 * in a frame must be one of them, or the wall is gone by the frame's end;
 * that was the boundary bug of 2026-09-15, found by the wall test.
 *
 * The material's uniforms table is bound by the owner: `line.vert` reads `px`.
 */
export function boundaryChildren() {
  const positionBuffer = new Float32Array([
    // left
    -1, -1, 0, -1, 1, 0,
    // top
    -1, 1, 0, 1, 1, 0,
    // right
    1, 1, 0, 1, -1, 0,
    // bottom
    1, -1, 0, -1, -1, 0,
  ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positionBuffer, 3))
  const material = new RawShaderMaterial({
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    uniforms: {},
  })
  return new LineSegments(geometry, material)
}

export function disposeBoundary(children) {
  children.geometry.dispose()
  children.material.dispose()
}
