// The vertex stages the passes share, as TSL. Each returns the clip-space
// position node and the varyings the fragment reads. `positionGeometry` is
// the quad's attribute, the GLSL `position`; a varying computed from it runs
// in the vertex stage and is interpolated, as a GLSL varying is.
import { positionGeometry, uv, varying, vec2, vec4, mix } from 'three/tsl'

/**
 * Sample a render-target texture at a y-up coordinate. The renderer stores a
 * render target's rows top first and a texture node flips y for it only when
 * sampled at its default uv; an explicit coordinate, which every pass uses,
 * reads the rows as stored. So the passes keep the GLSL's y-up coordinates
 * and offsets, and flip here, at the sample. Measured 2026-10-06: without
 * this, every pass read its input mirrored in y, invisible on a symmetric
 * field except for a one-texel offset that fed an odd-even instability.
 */
export const sampleRT = (textureNode, uvUp) => textureNode.sample(uvUp.flipY())

/**
 * face.vert: the full quad shrunk by `boundarySpace` on each side, so that with
 * the wall off the passes write one cell short of the rim. `uvInternal` is the
 * texture coordinate of the shrunk quad.
 */
export function faceVertex(boundarySpace) {
  const scale = vec2(1.0).sub(boundarySpace.mul(2.0))
  const pos = positionGeometry.xy.mul(scale)
  const uvInternal = varying(vec2(0.5).add(pos.mul(0.5)))
  return { vertexNode: vec4(pos, 0.0, 1.0), uvInternal }
}

/**
 * output.vert: the full quad, sampling the interior only. The rim is the
 * wall's, not the fluid's, so the picture maps 0..1 onto px..1-px.
 */
export function outputVertex(px) {
  const uv01 = vec2(0.5).add(positionGeometry.xy.mul(0.5))
  const uvInternal = varying(mix(px, vec2(1.0).sub(px), uv01))
  return { vertexNode: vec4(positionGeometry, 1.0), uvInternal }
}

/**
 * mouse.vert: the force quad, `scale` cells wide, placed at `center` in clip
 * space and clamped to the top-right edge as the GLSL did.
 */
export function forceVertex(center, scale, px) {
  const pos = positionGeometry.xy.mul(scale).mul(px).add(center)
  const vUv = varying(uv())
  return { vertexNode: vec4(pos.min(vec2(1.0)), 0.0, 1.0), vUv }
}
