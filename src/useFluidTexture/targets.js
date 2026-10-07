import { useEffect, useMemo } from 'react'
import { DataTexture, RenderTarget, Texture } from 'three/webgpu'

/** A texture node needs a texture before the first swap; this one is never sampled. */
export const EmptyTexture = /* @__PURE__ */ new Texture()

/** One black texel, for a texture node that may be sampled and must read zero: the mesh force with no mesh. */
export const ZeroTexture = /* @__PURE__ */ (() => {
  const t = new DataTexture(new Uint8Array(4), 1, 1)
  t.needsUpdate = true
  return t
})()

/**
 * A render target of the given size and options, rebuilt when either changes
 * and disposed when replaced or on unmount. `options` must be referentially
 * stable, a module constant or memoised by the caller, or the target is
 * rebuilt every render. The WebGPU renderer takes three's own RenderTarget,
 * which this allocates; drei's useFBO built the WebGL one. With `enabled`
 * false nothing is allocated and the hook returns null: a target that exists
 * only when an option asks for it (the mesh force's).
 */
export function useRenderTarget(width, height, options, enabled = true) {
  const target = useMemo(
    () =>
      enabled
        ? new RenderTarget(width, height, { depthBuffer: false, ...options })
        : null,
    [enabled, width, height, options],
  )
  useEffect(() => () => target?.dispose(), [target])
  return target
}
