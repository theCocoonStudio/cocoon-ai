# logo

The cocoon mark and wordmark, and every derived file. `cocoon-logo-spec.md` is the design spec; this file is the operating procedure.

## Files

- `mark.js` — the four-triangle mark through the shared engine, the square canvas, and the favicon.
- `wordmark.js` — the wordmark cut from Saira at `wght 350 / wdth 107` through fontkit, with the infinity mark derived from the instanced `o`.
- `lockup.js` — icon left of the wordmark, anchored in the wordmark's own units.
- `build.js` — `node assets/logo/build.js [outdir]`. Emits 45 SVGs and 5 PNG previews, and refuses if the four plain icon files change or the spec's tier table disagrees with the generator.
- `logo.test.js` — the rebuild regression, the triangle's geometry, the ramps, the lockup rule with a hand-picked gap proven to fail, and the wordmark against the fontTools cut.
- `Saira-VariableFont_wdth,wght.ttf`, `OFL.txt` — the source font and its licence. Needed to recut the wordmark; not needed at render time.
- `fixtures/cocoon-wordmark.fonttools.svg` — the wordmark as the original Python generator cut it. The test rasterises both at 1800 px; they differ in zero pixels.

| output                                      | anchored on                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `cocoon-icon-{vapour,dense}[-reversed].svg` | nothing; tight to the artwork, and the icon set's engine test compares against them      |
| `cocoon-icon-*-square.svg`                  | the front triangle's centre                                                              |
| `cocoon-favicon*.svg`                       | the front triangle, sized from the 10% clear-air rule                                    |
| `lockups/*.svg`                             | the front triangle's right edge, gap = air + worst trail, rounded up to the quarter stem |

## Recutting

The mark's scene is `src/utils/hazePlanes.js`; the triangle is `mark.js`. The wordmark's instance is `WORD_WGHT` and `WORD_WDTH` in `lockup.js`, and the mark's ratios are the constants at the top of `wordmark.js`. After any change: `npm run assets:logo`, read the output, `npm test`, and look at the PNGs.

A note on fontkit: it rounds each variation delta to whole units as it applies it, where fontTools summed them in floating point. `wordmark.js` switches that rounding off while an outline decodes. That is what makes the stem come out at 71.10, as the spec states, rather than 71.

## Known gaps

- The mechanism offered in the spec for why a pale trail near a letterform reads as a collision is descriptive, not tested. The lockup floor stands on the letterspacing derivation alone.
- Whether the planes should spread wider so the mark survives smaller sizes is under review; see the exploration in `explorations/`.
