# export:logo

`assets/logo/export.js`. Draws the mark or the lockup at scene values you choose, and beside it a sheet of the neighbours of each chosen value, so a decision about the scene is made by looking rather than by guessing. Nothing it writes is committed; it reads the same engine and the same wordmark the shipped files come from, so its output at the shipped values is the shipped file.

```bash
npm run export:logo -- --off 1.9
npm run export:logo -- --off 1.9 --spacing 1.2 -b 0.1 -c 2
npm run export:logo -- --off 1.9:0.05:3 --view icon --cut dense --reverse
npm run export:logo -- --help
```

## The grammar

```
--<param> <value>[:<buffer>[:<count>]]
```

`value` is the number you are choosing. `buffer` is the step either side of it, and `count` is how many steps; the sheet shows `value - count·buffer` up to `value + count·buffer`. `--off 1.9 -b 0.1 -c 2` draws 1.7, 1.8, 1.9, 2.0, 2.1. A buffer or count given on the parameter itself wins over the global `-b` and `-c`; a parameter given neither takes the global count and its own default buffer from the table below.

Parameters are swept one at a time. Each swept parameter gets a block of rows; within a block only that parameter changes and every other parameter holds its chosen value. The chosen row is marked in each block. Parameters you do not name hold the shipped scene and are not swept. `--off=1.9` is the same as `--off 1.9`.

Values the engine cannot draw are dropped from the sweep rather than failing the run, so a sweep that steps below zero simply has fewer rows. Integer parameters round and deduplicate.

## Parameters

Units are the ones the logo spec and `src/utils/hazePlanes.js` use. The design box is the width of the front shape on the 1000 grid.

| parameter   | what it is                                                                                                                                                                                                                                              | shipped                     | default buffer | range               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------- | ------------------- |
| `--off`     | Camera offset from the front shape, in shape widths. Larger spreads the planes further sideways; the trail behind the black triangle grows with it.                                                                                                     | 1.9                         | 0.1            | > 0                 |
| `--spacing` | Distance between neighbouring planes, in design boxes. Larger shrinks each plane behind more steeply, so the tiers step down faster.                                                                                                                    | 1                           | 0.1            | > 0                 |
| `--dist`    | Camera distance to the front plane, in design boxes. Larger flattens the recession; every plane behind comes closer to the front one's size.                                                                                                            | 6                           | 0.5            | > 0                 |
| `--planes`  | Number of planes, the front one included. Whole numbers. One plane is the black triangle alone.                                                                                                                                                         | 4                           | 1              | ≥ 1                 |
| `--corner`  | Fillet radius on the front shape's corners, as a fraction of the design box. Planes behind scale it with themselves.                                                                                                                                    | 0.02                        | 0.005          | ≥ 0                 |
| `--haze`    | Transmittance left after the whole row, the aerial-perspective total the tones are spread across. Smaller makes the back planes paler. The cut sets the default.                                                                                        | vapour 0.0756, dense 0.0225 | 0.02           | 0 to 1, exclusive   |
| `--apex`    | Apex angle of the triangle, degrees. 60 is equilateral; the shipped mark is sharper.                                                                                                                                                                    | 48                          | 4              | 0 to 180, exclusive |
| `--size`    | Lockup only. The icon's height as a multiple of the wordmark's x-height band.                                                                                                                                                                           | 1.0                         | 0.1            | > 0                 |
| `--gap`     | Lockup only. Clear space from the black triangle's right edge to the wordmark, in wordmark stems. Left unset, it is derived for each row by the tier rule at `--air`, as the shipped lockups are, and the derived figure is printed in the row's label. | derived                     | 0.25           | ≥ 0                 |
| `--air`     | Lockup only. The clear air the derived gap must deliver at the icon's size, in stems; the shipped tiers are 1, 2 and 3. Ignored when `--gap` is given.                                                                                                  | 2                           | 0.5            | ≥ 0                 |
| `--wght`    | Lockup only. The wordmark's weight axis in Saira. Recut per row.                                                                                                                                                                                        | 350                         | 50             | 100 to 900          |
| `--wdth`    | Lockup only. The wordmark's width axis in Saira. Recut per row.                                                                                                                                                                                         | 107                         | 5              | 50 to 125           |

The lockup parameters, `--size`, `--gap`, `--air`, `--wght` and `--wdth`, are refused in the icon view.

## Options

| option               | meaning                                                                                                | default                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `-b`, `--buffer <n>` | Step either side of the value, for every parameter that does not carry its own.                        | per parameter, table above                     |
| `-c`, `--count <n>`  | Steps either side, for every parameter that does not carry its own. `0` draws the chosen values alone. | 2                                              |
| `--view <v>`         | `lockup`, the icon left of the wordmark, or `icon`, the mark alone.                                    | `lockup`                                       |
| `--cut <c>`          | `vapour` or `dense`; sets the ground colour and the default haze.                                      | `vapour`                                       |
| `--reverse`          | Light on dark. The sheet stands on ink.                                                                | off                                            |
| `--surface <hex>`    | The ink, in place of `#141414`. Every plane's tone is re-mixed from it. A colour, not a sweep.         | the cut's                                      |
| `--ground <hex>`     | The ground the haze fades toward, in place of the cut's; also the sheet's background.                  | the cut's                                      |
| `--widths <a,b,...>` | Cell widths on the sheet, in px, one column each.                                                      | lockup 120,200,320,600; icon 32,64,128,256     |
| `--out <dir>`        | Where the files go.                                                                                    | `assets/logo/explorations/export/`, gitignored |
| `--name <n>`         | File stem.                                                                                             | `cocoon-<view>-<cut>[-reversed]`               |
| `-h`, `--help`       | The parameter list and these options.                                                                  |                                                |

## Output

Three files in `--out`:

- `<name>.svg`: the artwork at the chosen values. The second line is a comment naming every value used, the derived gap included, so the file explains itself when it turns up somewhere later.
- `<name>-examples.svg`: the sheet. One row per variant, one cell per width, the label above each row, blocks separated by a rule. The chosen row's label is full ink; the neighbours are lighter.
- `<name>-examples.png`: the sheet rasterised at 2x.

The terminal gets the chosen values, the row labels, and the three paths.

## Module API

The script is also a module, which is how it is tested. All functions are pure except `run`.

```js
import {
  parseArgs,
  chosen,
  variants,
  sweep,
  render,
  sheet,
  chosenSvg,
  run,
  PARAMS,
  VIEWS,
} from 'assets/logo/export.js'

const o = parseArgs(['--off', '1.9', '-c', '1']) // argv after the script name
chosen(o) // { off: 1.9, spacing: 1, dist: 6, planes: 4, corner: 0.02, haze: 0.075625, apex: 48, size: 1, gap: null }
variants(o) // [{ param: 'off', label: 'off 1.8', values, chosen: false }, ...]
sweep('off', { value: 1.9, buffer: 0.1, count: 2 }) // [1.7, 1.8, 1.9, 2, 2.1]
render(values, o) // { svg, ratio, gap } for one set of values in o.view
sheet(rows, o) // { svg, width, height }
chosenSvg(o) // { svg, values } with the comment line
run(o) // writes the three files; { paths, values, rows, sheet }
```

`PARAMS` is the table above as data: `{ doc, value, buffer, valid, integer?, lockup? }` per parameter, where `value` may be a function of the options for defaults that depend on the cut. `VIEWS` holds each view's default widths.

## Limits

- Sweeps are one parameter at a time. A grid over two parameters is not offered; run twice with the second fixed at each candidate.
- Another wordmark instance is for looking only. The lockup anchors on the stem width and x-height band of the shipped `350 / 107` cut, so at another weight the gap in "stems" is still measured in the shipped stem. Shipping a new instance is an edit to `WORD_WGHT` and `WORD_WDTH` in `lockup.js` and a re-derivation of those constants.
- Surface and ground are colours, so they are options rather than parameters: no buffer, no count, one value for the whole sheet. To compare two palettes, run twice.
- The sheet SVG repeats the wordmark path in every lockup cell, so it runs to a megabyte at the default widths. The PNG is the file to look at.
- Setting a chosen value into the shipped scene is a separate edit to `HAZE_DEFAULTS` in `src/utils/hazePlanes.js`, followed by `npm run assets` and `npm test`. The tool changes nothing shipped.
