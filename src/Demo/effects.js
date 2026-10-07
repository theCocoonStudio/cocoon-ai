/**
 * The effects a demo can take, as integers, in the `effects` prop array in
 * render order. Implemented through three's render pipeline for a scene on
 * the WebGPU renderer (the TSL display nodes); a legacy-renderer scene takes
 * the pmndrs wrapper, which has no WebGPU support (verified 2026-10-07).
 */
export const EFFECTS = Object.freeze({
  BLOOM: 0,
  DEPTH_OF_FIELD: 1,
  GODRAYS: 2,
  FXAA: 3,
})
