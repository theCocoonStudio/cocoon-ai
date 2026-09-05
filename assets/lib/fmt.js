/**
 * Fixed-point number formatting that matches Python's `f"{x:.{p}f}"`.
 *
 * The shipped SVGs were serialised by Python, and the regression tests compare
 * rebuilt files to them byte for byte. JavaScript's `toFixed` rounds an exact
 * tie away from zero; Python rounds it to even. Ties are rare but real, so the
 * exact decimal expansion is inspected and the tie case is settled by hand.
 */
export function fmt(x, prec = 3) {
  const exact = x.toFixed(Math.min(100, prec + 40))
  const dot = exact.indexOf('.')
  const tail = exact.slice(dot + 1 + prec)
  const isTie = /^50*$/.test(tail)
  if (!isTie) return x.toFixed(prec)
  // Exact tie: round half to even on the last kept digit.
  const kept = exact.slice(0, dot + 1 + prec)
  const digits = kept.replace('-', '').replace('.', '')
  const last = Number(digits[digits.length - 1])
  const down = Number(kept)
  if (last % 2 === 0) return down.toFixed(prec)
  const step = 10 ** -prec
  return (x < 0 ? down - step : down + step).toFixed(prec)
}

/** `fmt` over a point: "x y". */
export const fmt2 = (p, prec = 3) => `${fmt(p[0], prec)} ${fmt(p[1], prec)}`
