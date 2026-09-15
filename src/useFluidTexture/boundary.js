import {
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  RawShaderMaterial,
} from 'three'
import wallVert from './glsl/wall.vert?raw'
import wallFrag from './glsl/wall.frag?raw'

/**
 * The wall: four line segments on the rim, each cell of which takes `scale`
 * times its neighbour one cell inward, read from the pass's input texture.
 * GPU Gems ch. 38 §38.3, Listing 38-5: scale −1 on velocity after advection,
 * diffusion and projection, so the velocity at the wall face is zero; scale 1
 * on pressure after every Jacobi iteration, so the gradient across the wall
 * is zero. A pass that adds it as a child draws it after its quad.
 *
 * WebGL cannot sample the texture a pass writes, so the neighbour comes from
 * the pass's input, one step stale: for pressure that is a Jacobi iteration
 * exactly; for velocity it is the approximation every ping-pong
 * implementation makes, and the wall is redrawn after every step.
 *
 * The owner binds the material's uniforms: `field`, `px`, `scale`.
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
  // one cell toward the interior, per edge
  const inwardBuffer = new Float32Array([
    1, 0, 1, 0, 0, -1, 0, -1, -1, 0, -1, 0, 0, 1, 0, 1,
  ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positionBuffer, 3))
  geometry.setAttribute('inward', new BufferAttribute(inwardBuffer, 2))
  const material = new RawShaderMaterial({
    vertexShader: wallVert,
    fragmentShader: wallFrag,
    uniforms: {},
  })
  return new LineSegments(geometry, material)
}

export function disposeBoundary(children) {
  children.geometry.dispose()
  children.material.dispose()
}

/** Bind a pass's wall to the input it should copy from: `field` follows `pass.uniforms[key]`. */
export function bindWall(pass, key, px, scale) {
  pass.modifyChildren((wall) => {
    wall.material.uniforms = {
      field: pass.uniforms[key],
      px,
      scale: { value: scale },
    }
  })
  return pass
}

/** After a per-frame `updateUniforms` replaced the input entry, point the wall at the new one. */
export function followWall(pass, key) {
  pass.modifyChildren((wall) => {
    wall.material.uniforms.field = pass.uniforms[key]
  })
  return pass
}
