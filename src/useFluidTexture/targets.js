import { useEffect, useMemo } from 'react'
import { RenderTarget, Texture } from 'three/webgpu'

/** A texture node needs a texture before the first swap; this one is never sampled. */
export const EmptyTexture = /* @__PURE__ */ new Texture()

/**
 * A render target of the given size and options, rebuilt when either changes
 * and disposed when replaced or on unmount. `options` must be referentially
 * stable, a module constant or memoised by the caller, or the target is
 * rebuilt every render. The WebGPU renderer takes three's own RenderTarget,
 * which this allocates; drei's useFBO built the WebGL one.
 */
export function useRenderTarget(width, height, options) {
  const target = useMemo(
    () => new RenderTarget(width, height, { depthBuffer: false, ...options }),
    [width, height, options],
  )
  useEffect(() => () => target.dispose(), [target])
  return target
}
