// The eight passes of the simulation as TSL node materials: Stam's stable
// fluids as Harris describes them for the GPU (GPU Gems ch. 38), one material
// per pass, each built from the nodes the hook shares. A pass's inputs are
// the uniform and texture nodes it reads; the hook swaps a texture node's
// `.value` for the ping-pong and mutates a uniform's value in place.
import { AdditiveBlending, NodeMaterial } from 'three/webgpu'
import {
  Fn,
  If,
  float,
  length,
  max,
  min,
  mix,
  sqrt,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl'
import { faceVertex, forceVertex, outputVertex, sampleRT } from './common.js'

/** A material that writes `fragmentNode` from `vertexNode`, no depth, no lights. */
function passMaterial({ vertexNode, fragmentNode, blending }) {
  const m = new NodeMaterial()
  if (vertexNode) m.vertexNode = vertexNode
  m.fragmentNode = fragmentNode
  m.depthTest = false
  m.depthWrite = false
  m.lights = false
  m.fog = false
  if (blending) m.blending = blending
  return m
}

/** advection.frag: semi-Lagrangian back-trace, with BFECC's error correction when `isBFECC` is on. */
export function advectionMaterial({ velocity, dt, isBFECC, fboSize, px }) {
  const { vertexNode, uvInternal } = faceVertex(px)
  const fragmentNode = Fn(() => {
    const ratio = max(fboSize.x, fboSize.y).div(fboSize)
    const out = vec2(0.0).toVar()
    If(isBFECC.not(), () => {
      const vel = sampleRT(velocity, uvInternal).xy
      const spot = uvInternal.sub(vel.mul(dt).mul(ratio))
      out.assign(sampleRT(velocity, spot).xy)
    }).Else(() => {
      const spotNew = uvInternal
      const velOld = sampleRT(velocity, spotNew).xy
      const spotOld = spotNew.sub(velOld.mul(dt).mul(ratio)) // back trace
      const velNew1 = sampleRT(velocity, spotOld).xy
      const spotNew2 = spotOld.add(velNew1.mul(dt).mul(ratio)) // forward trace
      const error = spotNew2.sub(spotNew)
      const spotNew3 = spotNew.sub(error.div(2.0))
      const vel2 = sampleRT(velocity, spotNew3).xy
      const spotOld2 = spotNew3.sub(vel2.mul(dt).mul(ratio)) // back trace 2
      out.assign(sampleRT(velocity, spotOld2).xy)
    })
    return vec4(out, 0.0, 0.0)
  })()
  return passMaterial({ vertexNode, fragmentNode })
}

/** externalForce.frag on mouse.vert: a radial bump of `force`, added into the velocity. */
export function forceMaterial({ force, center, scale, px }) {
  const { vertexNode, vUv } = forceVertex(center, scale, px)
  const fragmentNode = Fn(() => {
    const circle = vUv.sub(0.5).mul(2.0)
    const d = float(1.0)
      .sub(min(length(circle), 1.0))
      .toVar()
    d.assign(d.mul(d))
    return vec4(force.mul(d), 0.0, 1.0)
  })()
  return passMaterial({ vertexNode, fragmentNode, blending: AdditiveBlending })
}

/**
 * controlForce.frag: a mesh's own geometry, drawn through the scene camera,
 * pushes outward from its centre by `force`. The default vertex path (model,
 * view, projection) is kept, as the GLSL did.
 */
export function meshForceMaterial({ force }) {
  const vUv = varying(uv())
  const fragmentNode = Fn(() => {
    const circle = vUv.sub(0.5).mul(2.0)
    return vec4(force.mul(-1.0).mul(circle), 0.0, 1.0)
  })()
  return passMaterial({ fragmentNode, blending: AdditiveBlending })
}

/** viscous.frag: one Jacobi iteration of implicit diffusion, two cells apart as the GLSL was. */
export function viscousMaterial({
  velocity,
  velocity_new,
  v,
  px,
  dt,
  boundarySpace,
}) {
  const { vertexNode, uvInternal } = faceVertex(boundarySpace)
  const fragmentNode = Fn(() => {
    const old = sampleRT(velocity, uvInternal).xy
    const dx = vec2(px.x.mul(2.0), 0.0)
    const dy = vec2(0.0, px.y.mul(2.0))
    const sum = sampleRT(velocity_new, uvInternal.add(dx))
      .xy.add(sampleRT(velocity_new, uvInternal.sub(dx)).xy)
      .add(sampleRT(velocity_new, uvInternal.add(dy)).xy)
      .add(sampleRT(velocity_new, uvInternal.sub(dy)).xy)
    const vdt = v.mul(dt)
    const next = old
      .mul(4.0)
      .add(sum.mul(vdt))
      .div(float(4.0).mul(vdt.add(1.0)))
    return vec4(next, 0.0, 0.0)
  })()
  return passMaterial({ vertexNode, fragmentNode })
}

/** divergence.frag: central differences, over dt. */
export function divergenceMaterial({ velocity, dt, px, boundarySpace }) {
  const { vertexNode, uvInternal } = faceVertex(boundarySpace)
  const fragmentNode = Fn(() => {
    const dx = vec2(px.x, 0.0)
    const dy = vec2(0.0, px.y)
    const x0 = sampleRT(velocity, uvInternal.sub(dx)).x
    const x1 = sampleRT(velocity, uvInternal.add(dx)).x
    const y0 = sampleRT(velocity, uvInternal.sub(dy)).y
    const y1 = sampleRT(velocity, uvInternal.add(dy)).y
    const divergence = x1.sub(x0).add(y1.sub(y0)).div(2.0)
    return vec4(divergence.div(dt))
  })()
  return passMaterial({ vertexNode, fragmentNode })
}

/** poisson.frag: one Jacobi iteration of the pressure solve, two cells apart as the GLSL was. */
export function poissonMaterial({ pressure, divergence, px, boundarySpace }) {
  const { vertexNode, uvInternal } = faceVertex(boundarySpace)
  const fragmentNode = Fn(() => {
    const dx = vec2(px.x.mul(2.0), 0.0)
    const dy = vec2(0.0, px.y.mul(2.0))
    const p0 = sampleRT(pressure, uvInternal.add(dx)).r
    const p1 = sampleRT(pressure, uvInternal.sub(dx)).r
    const p2 = sampleRT(pressure, uvInternal.add(dy)).r
    const p3 = sampleRT(pressure, uvInternal.sub(dy)).r
    const div = sampleRT(divergence, uvInternal).r
    const newP = p0.add(p1).add(p2).add(p3).div(4.0).sub(div)
    return vec4(newP)
  })()
  return passMaterial({ vertexNode, fragmentNode })
}

/** pressure.frag: the projection, velocity minus the pressure gradient times dt. */
export function pressureMaterial({
  pressure,
  velocity,
  px,
  dt,
  boundarySpace,
}) {
  const { vertexNode, uvInternal } = faceVertex(boundarySpace)
  const fragmentNode = Fn(() => {
    const dx = vec2(px.x, 0.0)
    const dy = vec2(0.0, px.y)
    const p0 = sampleRT(pressure, uvInternal.add(dx)).r
    const p1 = sampleRT(pressure, uvInternal.sub(dx)).r
    const p2 = sampleRT(pressure, uvInternal.add(dy)).r
    const p3 = sampleRT(pressure, uvInternal.sub(dy)).r
    const vel = sampleRT(velocity, uvInternal).xy
    const gradP = vec2(p0.sub(p1), p2.sub(p3)).mul(0.5)
    return vec4(vel.sub(gradP.mul(dt)), 0.0, 1.0)
  })()
  return passMaterial({ vertexNode, fragmentNode })
}

/**
 * color.frag on output.vert: white where still, dark where moving; the interior only.
 * This pass samples at the unflipped coordinate on purpose: a consumer shows the
 * picture through a material's `map`, which samples at the default uv, and in this
 * renderer that reads a render target mirrored in y on both backends (measured
 * against a screenshot, 2026-10-06). Writing the picture mirrored once here makes it
 * upright there; the fields keep the simulation's own layout.
 */
export function outputMaterial({ velocity, px }) {
  const { vertexNode, uvInternal } = outputVertex(px)
  const fragmentNode = Fn(() => {
    const vel = velocity.sample(uvInternal).xy
    const len = length(vel).div(sqrt(2.0))
    const color = mix(vec3(1.0), vec3(0.0), len)
    return vec4(color, 1.0)
  })()
  return passMaterial({ vertexNode, fragmentNode })
}
