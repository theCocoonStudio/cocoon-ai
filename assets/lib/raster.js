/**
 * Rasterising, for the checks that measure the shipped files rather than the
 * model that made them, and for the PNG previews. Uses resvg.
 */
import { Resvg } from '@resvg/resvg-js'

/** Render SVG text to { width, height, pixels } (RGBA, row-major). */
export function rasterize(svgText, { width, background = 'white' } = {}) {
  const r = new Resvg(svgText, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    background,
  })
  const img = r.render()
  return { width: img.width, height: img.height, pixels: img.pixels }
}

/** Render SVG text to a PNG buffer. */
export function png(svgText, { width, background = 'white' } = {}) {
  const r = new Resvg(svgText, {
    fitTo: width ? { mode: 'width', value: width } : { mode: 'original' },
    background,
  })
  return r.render().asPng()
}

/** Grey level per pixel from an RGBA buffer. */
export function grey({ width, height, pixels }) {
  const out = new Uint8Array(width * height)
  for (let i = 0; i < out.length; i++)
    out[i] = (pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3
  return { width, height, grey: out }
}

/** Margins of ink (grey < threshold) inside the image: { l, r, t, b }, in pixels. */
export function inkMargins({ width, height, grey: g }, threshold = 250) {
  let l = width
  let r = width
  let t = height
  let b = height
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (g[y * width + x] < threshold) {
        l = Math.min(l, x)
        r = Math.min(r, width - 1 - x)
        t = Math.min(t, y)
        b = Math.min(b, height - 1 - y)
      }
  return { l, r, t, b }
}

/** Fraction of pixels whose grey differs by more than `tol` between two same-size renders. */
export function pixelDiff(a, b, tol = 64) {
  if (a.width !== b.width || a.height !== b.height)
    throw new Error(
      `pixelDiff: sizes differ ${a.width}x${a.height} vs ${b.width}x${b.height}`,
    )
  let n = 0
  for (let i = 0; i < a.grey.length; i++)
    if (Math.abs(a.grey[i] - b.grey[i]) > tol) n++
  return { differing: n, total: a.grey.length, fraction: n / a.grey.length }
}
