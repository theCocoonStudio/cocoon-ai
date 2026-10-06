import {
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  NodeMaterial,
} from 'three/webgpu'
import {
  Fn,
  attribute,
  positionGeometry,
  sign,
  texture,
  uniform,
  varying,
  vec2,
  vec4,
} from 'three/tsl'
import { EmptyTexture } from './targets.js'
import { sampleRT } from './tsl/common.js'

/**
 * The wall: four line segments on the rim, each cell of which takes `scale`
 * times its neighbour one cell inward, read from the pass's input texture.
 * GPU Gems ch. 38 §38.3, Listing 38-5: scale −1 on velocity after advection,
 * diffusion and projection, so the velocity at the wall face is zero; scale 1
 * on pressure after every Jacobi iteration, so the gradient across the wall
 * is zero. A pass that adds it as a child draws it after its quad.
 *
 * A pass cannot sample the texture it writes, so the neighbour comes from
 * the pass's input, one step stale: for pressure that is a Jacobi iteration
 * exactly; for velocity it is the approximation every ping-pong
 * implementation makes, and the wall is redrawn after every step.
 *
 * The owner binds the wall's nodes: `field`, `px`, `scale` (`bindWall`), and
 * repoints `field` after a per-step swap (`followWall`).
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

  const field = texture(EmptyTexture)
  const px = uniform(vec2(0, 0))
  const scale = uniform(1.0)
  // wall.vert: the rim cell's centre, and one cell toward the interior
  const pos = positionGeometry.xy
  const uvInternal = varying(vec2(0.5).add(pos.mul(0.5)))
  const vInward = varying(attribute('inward', 'vec2').mul(px))
  const n = sign(pos)
  const shrunk = pos.abs().sub(px).mul(n)
  const material = new NodeMaterial()
  material.vertexNode = vec4(shrunk, positionGeometry.z, 1.0)
  // wall.frag: scale times the neighbour one cell inside
  material.fragmentNode = Fn(() =>
    sampleRT(field, uvInternal.add(vInward)).mul(scale),
  )()
  material.depthTest = false
  material.depthWrite = false
  material.lights = false
  material.fog = false
  const wall = new LineSegments(geometry, material)
  wall.userData.nodes = { field, px, scale }
  return wall
}

export function disposeBoundary(children) {
  children.geometry.dispose()
  children.material.dispose()
}

/** Bind a pass's wall to the input it should copy from: `field` follows `pass.uniforms[key]`. */
export function bindWall(pass, key, px, scale) {
  pass.modifyChildren((wall) => {
    const nodes = wall.userData.nodes
    nodes.field.value = pass.uniforms[key].value
    nodes.px.value = px.value
    nodes.scale.value = scale
  })
  return pass
}

/** After a per-step `updateUniforms` repointed the input, point the wall at the new texture. */
export function followWall(pass, key) {
  pass.modifyChildren((wall) => {
    wall.userData.nodes.field.value = pass.uniforms[key].value
  })
  return pass
}
