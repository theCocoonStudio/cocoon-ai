# icons

Thirteen UI icons drawn in the language of the cocoon mark, shipped as the front face alone with no colour and no margin. The four-plane haze is not in the files; it is the constraint a shape has to satisfy to be in the set, and it is applied downstream by `HazePlanes`.

Two files per icon, both `fill="currentColor"`:

| file                     | viewBox                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `icon-<name>.svg`        | the ink's own bounding box, no margin on any side                   |
| `icon-<name>-square.svg` | square, side = the longer ink dimension, ink centred on the shorter |

`cocoon-icon-set-spec.md` is the design spec: the scene, stroke weight, corners, colour, the two boxes, and notes per icon. This file is the operating procedure.

## Files

- `shapes.js` — the front shapes, `SET` (what gets built) and `NOTES` (what the contact sheet says about each).
- `build.js` — `node assets/icons/build.js [outdir]`. Emits the files and `preview.html`, runs the guards, prints the ledger including what it did not run.
- `guards.js` — the five guards as pure functions over data.
- `specimen.js` — the contact sheet template.
- `icons.test.js` — the rebuild regression, every guard proven able to fail, the raster check, and engine properties.
- `preview.html` — the contact sheet. Open it off disk. Colour inheritance, tight vs square, the set in a row at 16 to 48 px on light and dark, and the four-plane render of every icon marked as not shipped.

## Adding an icon

1. Write a function in `shapes.js` returning the front shape on the 1000 grid. Use `rect`, `arrow`, `bars`, `circle`, `hole`; express every dimension as a multiple of `BAR`. Prefer removing material from a solid mass over assembling thin strokes, and keep separate components in separate fill groups.
2. Add it to `SET` and a `[role, note]` to `NOTES`.
3. `npm run assets:icons`. Read the whole ledger.
4. Open `preview.html` and look at the haze section. This is the step that decides whether the shape belongs: if it fills with its own echoes, thicken the walls or go solid. The spec's aperture ceiling is about 1.6 strokes.
5. `npm test`. The raster check and the rebuild regression run there.

## The guards

| guard                            | what it binds                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| front face == plane 0            | the shipped outline is character for character what the haze scene draws                                              |
| one stroke weight, live          | moving `BAR` must change every icon                                                                                   |
| viewBox flush / square / centred | measured from the ink after translation, against the viewBox written to the file, and again from the file's own paths |
| no two names, one picture        | caught a second name for `arrow-left` once                                                                            |
| no colour in any file            | every fill `currentColor`, no hex                                                                                     |

Each has a test that makes it fail. The raster test renders every file at 400 px and requires the ink flush on the tight axis and centred within a pixel.

## Known gaps

- `launch` does not read as "open" at UI sizes in the alignment row. Redraw or ship as is: undecided.
- Optical sizing is bounding-box sizing. See `assets/README.md`.
