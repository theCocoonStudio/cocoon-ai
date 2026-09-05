# assets

The studio's marks, produced here rather than stored here. Every SVG and PNG in this tree is the output of a script beside it, and a test fails if a committed file differs from what its script emits. Change a shape or a scene constant, run the build, commit the result.

```bash
npm run assets            # rebuild everything
npm run assets:icons      # the icon set and its contact sheet
npm run assets:logo       # the mark, favicons, wordmark, lockups, PNG previews
npm run export:logo -- --off 1.9 -b 0.1 -c 2   # the lockup or icon at chosen scene values, plus a sheet of neighbours
npm test                  # the guards, the rebuild regression, the raster checks
```

## Layout

```
assets/
  lib/
    haze.js       the four-plane engine: scene, tone, fillets, fill groups, serialiser, ink measurement
    fmt.js        number formatting that rounds like Python, so old files compare byte for byte
    raster.js     resvg wrappers: render, ink margins, pixel diff
  icons/          the UI icon set. shapes.js is the source; build.js emits 26 SVGs and preview.html
  logo/           the mark, favicons, wordmark and lockups. build.js emits 45 SVGs and 5 PNGs
```

Both folders read the scene from `src/utils/hazePlanes.js`, the same module the `HazePlanes` component uses. Plane count, spacing, camera distance and offset, and the two haze cuts live in one place. The old Python folders each restated those numbers and had no check that they agreed; now they cannot disagree.

## What the checks are for

Three rules, learned the hard way in the Python versions and kept here.

1. **A check that has never failed is not a check.** Two of the original icon guards passed over broken geometry when first written. Every guard in `icons/guards.js` therefore has a test in `icons.test.js` that feeds it the defect it exists to catch, and the lockup rule has one in `logo.test.js`.
2. **At least one check measures the output, not the model.** All the geometry guards read the same pipeline the artwork came from, so they can agree and be wrong together. That happened: fillets cut a pointed tip inward, so a tight box measured on the polygon shipped with 4.5% of margin while every guard passed. The raster tests render the shipped files and find the ink in pixels.
3. **The rebuild must equal the committed files.** That is the regression. It also means a scene change shows up as a diff in every file it touches, which is the review you want.

## Runtime

Node only. fontkit reads the variable font for the wordmark; resvg rasterises for the checks and the previews. Both are devDependencies. There is no Python left; the original generators live in the records repo for history.

## Ahead

- Optical sizing. Marks occupy equal boxes, not equal visual weight: `exit` reaches all four corners, `account` reads small. A per-icon optical scale, chosen by eye, would close it. Deliberately not done yet.
- The haze constraint is enforced for geometry, not legibility. The build proves the shipped face is plane 0 of the haze scene; whether a new shape still reads as four planes is decided by looking at the contact sheet's haze section, and nothing mechanical replaces that.
- A three.js playground for the scene, shared with the `HazePlanes` component.
