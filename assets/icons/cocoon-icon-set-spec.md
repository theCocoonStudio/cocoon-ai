# cocoon — icon set specification

The UI icon set drawn in the same language as the cocoon mark. It assumes the
**cocoon logo spec and the icon artwork** as its source of truth for the scene
and the colour; nothing here restates those derivations, it only says how an
arbitrary icon is fitted into them.

One sentence: _every icon is its own outline, chosen so that it would stand
four deep in the same row under the same camera and the same atmosphere as the
logo's triangles — and shipped as the front face alone._

**What is in this folder.** Two files per icon, both front-face only, both
uncoloured:

| file                     | viewBox                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `icon-<name>.svg`        | the ink's own bounding box — no margin on any side                  |
| `icon-<name>-square.svg` | square, side = the longer ink dimension, ink centred on the shorter |

Every fill is `currentColor` (§5). The haze is **not** in the artwork; it is the
constraint a new shape has to satisfy to belong here at all (§1, §5a, §6), and it
is applied downstream — in CSS, by the box-shadow generator, or by the React
wrapper.

Everything below is in **design units**. The files are unitless SVG, so any
consistent scale works; only the ratios matter.

---

## 1. The scene, collapsed

The logo's icon is four congruent triangles in a row seen through a shift
camera. Because the image plane is held parallel to the subjects, the whole
projection reduces to a similarity transform about one point, and that is the
only thing a new shape has to obey:

> Put the front shape's **area centroid** at `(−1.30 W, 0)`, where `W` is the
> shape's own projected width.
> Plane _k_ is the whole front shape **scaled about the origin `(0, 0)`** by

    S_k = D / (D + k·d)  with D = 6s, d = 1s   →   1 : 6/7 : 3/4 : 2/3

The origin is the camera's principal point; the row axis sits **1.30 shape
widths** left of it. Three consequences worth stating, because they are what
makes the set cohere:

- **The recession is purely horizontal.** All four centroids share the line
  `y = 0`, so nothing climbs or falls. The first step is `1.30 W · (1 − 6/7)`;
  the steps decelerate in the ratio 186 : 139 : 108 — the signature of real
  perspective rather than a geometric series.
- **Every plane is congruent to the front one.** Planes are never redrawn,
  restyled, or nudged. If a plane looks wrong, the front shape is wrong.
- **The spread is always 43% of the front shape's own width.** This is the one
  place the system reads the shape back, and it is deliberate. A fixed offset
  in design units spreads a narrow icon's planes far wider, relative to itself,
  than a broad one's: at 1000 units the up arrow's four shafts separated into
  stripes while the exit mark stayed properly stacked, and the set stopped
  looking like one set. Measuring the offset in shape widths fixes the
  _relative_ spread instead. The logo's triangle is exactly one box wide, so it
  is untouched — nothing about the mark changes.

### 1.1 Mirroring the camera

`mirror=True` puts the camera the same distance to the **left** of the row, so
the planes recede leftward. It is the identical scene seen from the other side;
no shape is redrawn.

Use it for shapes that point left. Left-pointing artwork under the default
camera has its rear planes emerge _past the tail_ as fletching — legible, but
the depth reads as texture rather than distance. `arrow-left` therefore carries
`mirror=True`.

**It no longer changes the shipped file.** `mirror` moves the camera, and the
camera is exactly what front-face-only output discards: plane 0 stays congruent,
so the two cuts serialise byte-for-byte identical once the trail is gone. The old
`arrow-left-camright` entry was therefore dropped from `SET` — it was a second
name for one picture. The flag stays, because it still governs the haze render,
which is what a shape is judged against. The build refuses to ship two names for
one picture (§7), which is how this was caught rather than shipped.

**Where the fletching goes instead.** The effect was worth keeping, and now that
the haze is applied downstream it belongs there: the React haze component takes
an **`angle` prop**, so the direction the planes recede is chosen at the point of
use rather than frozen into a file. One icon, any camera. That is strictly more
than the old pair could do — `arrow-left-camright` offered exactly two of the
directions this offers all of.

## 2. The design box

Draw the front shape in SVG coordinates (**y down**) on a nominal
**1000 × 1000** grid. Before projection the shape's **longer dimension** is
normalised to 1000. Width or height may be held instead, but `max` is the
default and it is what makes a tall icon and a wide one carry the same weight
in a row of them. The logo's triangle is 1000 × 743, so `max` reproduces it
untouched — that is the regression test (§7).

Placement is by **area centroid**, not by bounding box. Holes subtract. This is
the logo's own rule and it is why a gear and an arrow sit at the same visual
depth despite having nothing in common.

## 3. Stroke weight

Stroke-built icons share one thickness, **BAR = 0.15 × the design box** (150
units). This was chosen by rendering the set at 0.10 / 0.13 / 0.16 / 0.18 /
0.22 and looking:

All of it is stroke, not offset: the camera is never moved to fix weight, and
the weight is never moved to fix spread. Those are §1's job and §3's job
respectively.

| bar      | what happens                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| 0.10     | the four planes' strokes collapse into a stripe pattern; the icon stops reading as depth and starts reading as moiré |
| 0.13     | clean, light — closest to a conventional UI stroke                                                                   |
| **0.15** | **the cut. Rear planes read as separate objects, the front shape still has real mass**                               |
| 0.18     | heavier; the planes begin to close up                                                                                |
| 0.22     | the rear planes are mostly occluded; the depth stops paying for itself                                               |

Everything derived from the stroke is expressed as a multiple of it — arrow
heads at `3.2×` wide and `2.0×` long, list markers at `1.15×`, row gaps at
`1.35×`, the gear's tooth depth at `0.8×` and its rim at `4/3×` — so re-cutting
the set at another weight only needs `BAR` changed.

**That sentence is checked, not asserted** (§7), because it has been false
twice. First when sixteen shape signatures bound `bar=BAR` as a default
argument — Python evaluates those at def time, so changing the module constant
did nothing at all. Then again when `settings` accepted `bar` and ignored it:
the gear was drawn in fractions of the box, so at a lighter set weight it alone
would have stayed heavy. Both are the same failure — a documented instruction
that does not work — and prose cannot tell you it has happened. The build now
moves `BAR` from 0.15 to 0.13 and requires **every** icon's geometry to change.

What is not established: that the gear's `0.8` and `4/3` are right at other
weights. They reproduce the drawn proportions exactly at 0.15 and are preserved
ratios, not derived ones. Look at the gear specifically if the set is re-cut.

## 4. Corners

Every corner is filleted at **r = 0.02 × the design box**, tangent to both
edges, **convex** — bulging out toward the vertex it replaces. The radius is
applied per plane as `0.02 · box · S_k`, so it recedes with the shape exactly
as a physical rounding would.

The fillet handles **reflex** corners as well as convex ones. The tangent
distance `t = r / tan(θ/2)` comes from the angle between the two edge rays,
which is the same quantity either way; only the arc's sweep flag differs, and
it follows the turn direction of the traversal — `sweep = 1` where the
traversal turns clockwise on screen. Where two corners would overrun a short
edge, both tangent distances are scaled back until they fit and the radius
shrinks with them; the arc stays tangent, it just gets tighter.

Repeated points are dropped before filleting. A polygon that closes back onto
its own start — an arc swept a full 180°, say — would otherwise hand the
tangent maths a zero-length edge and divide by zero.

The check, if the arcs ever look wrong: measure the area removed, don't reason
about handedness. A convex fillet removes `r·t − ½r²(π − θ)` per corner; an
inverted sweep gouges a much larger concave bite.

## 5. Colour

**There is none in the files.** Every path is:

    fill="currentColor"

so an icon takes the CSS `color` of whatever contains it, the way text does.
Nothing in the file overrides an inherited colour — no `color` attribute on the
root, no internal `<style>` — because either would win against inheritance and
defeat the point.

The consequence worth knowing: a file opened on its own, or loaded through
`<img>` or `background-image`, has nothing to inherit from and falls back to the
browser's default text colour, which is pure black rather than the house
`#141414`. **The default belongs to the consumer, not to the file** — the React
wrapper carries `#141414` as its default `color` prop. A standalone file that
must be house black should be wrapped, not edited.

The build fails if a shipped file contains a hex colour at all (§7).

## 5a. The haze, and what leaving it out costs

The four-plane atmosphere is still the system. It is simply not baked into these
files, and the trade is deliberate:

| baked in                                          | inherited                                                     |
| ------------------------------------------------- | ------------------------------------------------------------- |
| four files per icon per cut, eight with reversals | two files, total                                              |
| recolouring means regenerating artwork            | recolouring is a CSS `color`                                  |
| the haze is frozen at the tones chosen here       | the haze is a live effect that can answer hover, theme, state |
| the file carries its own background assumption    | the file is transparent and composites onto anything          |

**The constraint stays.** A shape earns its place by still reading as four
receding planes under §1's scene — that is what §6's aperture ceiling is about,
and why `launch` is a solid panel rather than a frame. A shape that only works
flat does not belong here, even though nothing in the shipped file would reveal
the difference. Two things keep that from becoming a slogan: `build.js`
checks that the shipped face is character-for-character plane 0 of the haze
render, so the two cannot drift apart quietly, and `preview.html` renders the
four-plane version of every icon for inspection, marked as not shipped.

The tones, for whatever applies them downstream — aerial perspective, not four
greys, mixed in **linear light** and only then encoded to sRGB:

    L_k = L_surface · T^k + L_haze · (1 − T^k)

| cut                  | haze      | T      | k=0       | k=1       | k=2       | k=3       |
| -------------------- | --------- | ------ | --------- | --------- | --------- | --------- |
| **vapour** (default) | `#FFFFFF` | 0.4229 | `#141414` | `#C8C8C8` | `#EAEAEA` | `#F6F6F6` |
| vapour reversed      |           |        | `#FFFFFF` | `#AFAFAF` | `#777777` | `#515151` |
| **dense**            | `#E8E8E8` | 0.2823 | `#141414` | `#C9C9C9` | `#E0E0E0` | `#E6E6E6` |
| dense reversed       |           |        | `#E8E8E8` | `#858585` | `#4B4B4B` | `#2C2C2C` |

`T` is derived, not chosen: `T = (T_total)^(1/3)` with `T_total` = 0.275² for
vapour and 0.15² for dense. **Use dense for print, for off-white grounds, and
below about 32 px** — vapour's back plane at `#F6F6F6` reads on a white screen
and disappears anywhere else.

## 6. Shapes, holes, and fill groups

A shape is a list of elements: a polygon, a circle, or either marked as a
**hole**. A non-hole element opens a fill group; a hole joins the group before
it. Each group becomes one `<path>`, carrying `fill-rule="evenodd"` only if it
contains a hole.

That grouping is load-bearing. Putting every element in one evenodd path makes
separate components — a panel and the arrow leaving it — **cancel where they
overlap** instead of uniting. Putting holes in their own path makes them fill
instead of knock out. One group per component, holes attached to their own
outline.

### What this system suits

Solid masses, the way the logo's triangles are. A disc, a gear, a filled panel,
a thick arrow: the planes behind stack into a visible recession and the front
shape still reads instantly.

### The one case it fights

**Hollow outlines.** An outline frame has a large interior, and the planes
behind land _inside_ it — the icon fills up with its own echoes and stops
reading. This is why `launch` is a filled panel with an arrow breaking out of
its corner rather than the conventional external-link frame. The frame version
is kept in `shapes.js` as `launch_frame()` and is deliberately not in `SET`.

Where a hollow shape is unavoidable, thicken the walls until the aperture is
small relative to the 186-unit first step, or knock the detail out of a solid
mass instead — which is what `info` does: a filled disc with the _i_ removed,
so the plane behind shows through the counter.

**The threshold, measured on the one hollow icon in the set.** `search` holds at
a wall of **1.55 strokes**, which puts its aperture at 293 units against a
186-unit first step — a ratio of **1.58**. At that ratio the front plane's own
step covers most of the opening and what shows inside is a single crescent
rather than a stack. Drawn at the normal 1-stroke wall the aperture was 420
units, ratio 2.26, and it filled with its own echoes. Treat **~1.6 as the
ceiling**: above it, thicken the wall or go solid.

## 6a. The two boxes

Every icon ships twice. Same artwork, same path data, different viewBox.

| file                     | viewBox                                                             | for                                                                |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `icon-<name>.svg`        | the ink's bounding box, origin `0 0`                                | placing the mark exactly, when you control the space around it     |
| `icon-<name>-square.svg` | square, side = the longer ink dimension, ink centred on the shorter | dropping into equal slots — one CSS size rule serves the whole set |

**Why the square exists.** The tight box has a different aspect ratio for every
icon, so no single CSS rule sizes the set: `width: 24px` renders the gear at 24
and the up arrow at 54, and `height: 24px` swaps which one is wrong. Worse, in a
row of equal slots the marks land at different optical sizes for reasons that
have nothing to do with the marks. The square viewBox moves that problem into
the file, where it is solved once, and out of every consumer.

**Nothing else is in the file.** No background, no rounded corner, no padding.
Those are one CSS declaration each at the point of use, and baking them in
would fix decisions the file has no business fixing. This replaced an earlier
tile format that carried all three.

### The measurement that changed the rule

"The tight box equals the ink" was written, checked, and **false**. `bounds()`
measures the polygon; the artwork is that polygon _with its corners filleted_,
and a fillet cuts inward. Wherever a shape ends in a point, the sharp vertex
sits outside the ink that actually gets painted. Rendered and measured:

| icon         | margin on a box documented as having none                                    |
| ------------ | ---------------------------------------------------------------------------- |
| `arrow-up`   | **4.5%** of the width, both sides                                            |
| `exit`       | 0.75% on all four                                                            |
| `arrow-left` | 1.1% on the left only — so the mark also sat **off centre on its long axis** |

Every model-level check passed, because they all read the same polygon the
error came from. A raster of the shipped files disagreed. Both boxes are now
measured on the **drawn outline**, arcs included (`paths_bounds()`), which is
why the square sides come out **983.4 – 1000.0** rather than a uniform 1000:
the difference is exactly how much each shape's tip gets rounded off.

Consequences worth stating rather than discovering later:

- **Square sides differ between icons, and that is correct.** Each icon's mark
  is flush to its own box on the long axis, so in equal slots every mark renders
  at the same size. A uniform 1000 box would leave the pointed icons fractionally
  small.
- **Five icons ship identical tight and square files** — `settings`, `info`,
  `exit`, `launch`, `search` — because their ink is already square. They still
  ship both names, so a consumer choosing `-square` never has to know which.
- **Serialisation moves the outline slightly.** Coordinates ship at 3 decimals
  and a renderer rebuilds each arc from them; where a fillet turns through nearly
  180° the reconstruction is ill-conditioned. Measured worst case in the set:
  **0.61 units in 1000**, on `search`. That is 0.08 px on a 128 px render. The
  build fails above 1 unit.

## 7. Verification

Five guards run inside `build.js`, and the build refuses rather than
warns. Three more are separate commands, and the build **prints them as not
run** rather than staying quiet about them — a report that lists only what was
executed reads thorough while hiding its own gaps.

| check                              | what it binds                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| front face == plane 0              | the shipped outline is character-for-character what the haze scene draws. Without this, §5a is a wish |
| one stroke weight, live            | moving `BAR` must change every icon (§3)                                                              |
| viewBox flush / square / centred   | measured from the ink **after** translation against the viewBox **actually written to the file**      |
| no two names, one picture          | caught `arrow-left-camright`                                                                          |
| no colour in any file              | no hex anywhere; every fill `currentColor`                                                            |
| `icons.test.js`                    | every guard above, proven capable of failing                                                          |
| the raster test in `icons.test.js` | the shipped files rendered and measured in pixels                                                     |
| `logo.test.js`                     | the logo, through this same engine, byte-for-byte                                                     |

### Why `icons.test.js` exists

A check that has never failed is not a check: a pass is equally consistent with
the check measuring the wrong quantity, and a real guard and a fake one produce
identical-sounding prose. This is not hypothetical here — **two of the checks in
this folder were fake when written**:

1. An earlier tile check asserted on `tile()`'s internal fit factor instead of
   the measured gap, and passed at fills where the real clearance was 0.064
   against a 0.10 floor.
2. The centring check compared the file's viewBox against the artwork's
   _untranslated_ size. Replacing the centring translation with one that jams
   every icon into its top-left corner **did not make it fail**. It was rewritten
   to measure the translated ink, and then it failed in 3 ms.

So the guards are not trusted until each has been watched to fail. `icons.test.js`
mutates a scratch copy of the source, once per guarded property, and requires
the build to refuse. It reports three outcomes and only the first is acceptable:
`fired`, `DID NOT FIRE`, and `SKIPPED` — the last meaning the mutation text no
longer matches the source, so nothing was tested. **`SKIPPED` is a failure**, and
it is the sneaky one: a mutation that silently fails to apply is indistinguishable
from a clean run unless it is reported. That has happened here too.

Current state: **9/9 mutations fire.**

The battery needs the same suspicion applied to itself. The stroke-weight
mutation reported `DID NOT FIRE` when first written — but the fault was the
mutation, which removed only one of the gear's two dependencies on `BAR` while
the other still responded. A mutation has to remove the guarded property
_entirely_, or "did not fire" is a fact about the mutation rather than about the
guard.

### Why the raster test in `icons.test.js` exists

Every other check reads the same geometry pipeline the artwork comes out of, so
they can agree with each other and be wrong together — which is exactly what
happened to the tight box in §6a. At least one check has to measure the
**output**. This one renders every shipped file and finds the ink in pixels:

    worst margin on the tightest axis:                0 px
    worst |left−right| or |top−bottom|:               0 px
    at 400 px and again at 1200 px on the long side

It needs `cairosvg` or Playwright. Where neither is installed it prints
`NOT RUNNABLE` and exits 0 — a check that cannot run in a given place says so
out loud rather than being quietly absent. It is not optional; only its location
is.

## 8. Files

| File                               | Contents                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/haze.js`                      | The engine — scene, tone, fillets, fill groups, outline measurement, serialiser                                                                                                         |
| `shapes.js`                        | The front shapes, and `SET`, the list that gets built                                                                                                                                   |
| `build.js`                         | Renders the two files per icon, runs the four build guards, prints the ledger                                                                                                           |
| `icons.test.js`                    | Proves each guard can fail — 9 mutations (§7)                                                                                                                                           |
| the raster test in `icons.test.js` | Renders the shipped files and measures the ink (§7)                                                                                                                                     |
| `logo.test.js`                     | The logo regression (§7)                                                                                                                                                                |
| `specimen.js`                      | The contact sheet's page template, kept apart so the build stays readable                                                                                                               |
| `icon-<name>.svg`                  | The artwork, viewBox = ink bounding box                                                                                                                                                 |
| `icon-<name>-square.svg`           | The same artwork in a square viewBox                                                                                                                                                    |
| `preview.html`                     | Contact sheet, self-contained: colour inheritance, both boxes side by side, the set on light and dark down to 16 px, and the four-plane haze render of every icon marked as not shipped |
| `cocoon-icon-set-spec.md`          | This document                                                                                                                                                                           |
| `README.md`                        | The operating procedure — what to run, the last measured numbers, and the three rules §7 exists to enforce                                                                              |

Current set — 13 icons, 26 files: `arrow-left`, `arrow-right`, `arrow-up`,
`scroll-top`, `menu`, `toc`, `settings`, `info`, `exit`, `launch`, `home`,
`search`, `account`.

`SET` maps each name to `(shape function, engine options)` — the options dict is
where `mirror` and any future per-icon override live.

## 9. Adding an icon

1. Write a function in `shapes.js` returning the front shape in SVG coordinates
   on the 1000-grid. Use `rect`, `arrow`, `bars`, `_arc`, `_rot`, `_mirror_x`;
   express every dimension as a multiple of `BAR`. `_arc` is for curves the
   fillet cannot make: the fillet radius is fixed at 0.02 of the box, far too
   tight for something like a shoulder, so anything rounder has to be drawn as
   points.
2. Add it to `SET`, and add a `(role, note)` entry to `NOTES` beside it so the
   contact sheet describes it.
3. `npm run assets:icons` — read the whole ledger, not just the last line.
4. Open `preview.html` and look at **the haze section**. This is the step that
   decides whether the shape belongs in the set at all (§5a, §6): if it fills
   with its own echoes, thicken the walls or take material out of a solid mass
   instead. Nothing in the shipped file will tell you this later.
5. `npm test` where a renderer is installed.
6. `npm test` if any guard or any geometry code was touched — and if
   you added a guard, add its mutation, or it is untested by construction.
7. `npm test` if the engine was touched.

Two habits worth keeping: put separate components in separate fill groups, and
prefer removing material from a solid to assembling thin strokes.

## 10. Notes on individual icons

| icon                      | note                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arrow-right`             | The rear heads trail off to the right as a chevron echo — the best case the system has                                                                                                                                                                                                                                                                                 |
| `arrow-left`              | Mirrored camera (§1.1), so it recedes leftward and reads as the exact counterpart of `arrow-right` under the haze. Front-face only it is `arrow-right` mirrored, which is why the old `arrow-left-camright` entry is gone                                                                                                                                              |
| `arrow-up` / `scroll-top` | The two narrow shapes in the set, and the two whose tight box is taller than wide, and the reason §1's offset is measured in shape widths. `scroll-top` is the up arrow under a rule; the rule is exactly as wide as the arrowhead and sits within 0.6 stroke of it, so the pair recedes as one object. Use `arrow-up` where a plain direction is meant                |
| `menu` / `toc`            | Both are rule stacks; the markers are what keep `toc` from reading as `menu` at small sizes                                                                                                                                                                                                                                                                            |
| `settings`                | Gear teeth are straight-sided and the valleys are stepped along the root circle, so every corner is a real corner the fillet can take                                                                                                                                                                                                                                  |
| `info`                    | Filled disc with the _i_ knocked out. The counter shows the plane behind, which an outline ring would not                                                                                                                                                                                                                                                              |
| `launch`                  | Filled panel, arrow unioned into its top-right corner — the same direction the logo points. See §6 for why not the frame                                                                                                                                                                                                                                               |
| `home`                    | A solid house with the doorway knocked out — the same remove-material-from-a-mass move as `info`. The roof overhangs the walls by one stroke each side, which is what stops the silhouette reading as a plain pentagon                                                                                                                                                 |
| `search`                  | The one hollow shape in the set. Walls at **1.55 strokes**, giving an aperture-to-step ratio of 1.58 — inside the ceiling in §6, so it does not fill with its own echoes. A solid disc was tried and rejected: it reads as a pin at 16 px and collides with `info`, which is also a black disc. Ring and handle are separate fill groups so they union where they meet |
| `account`                 | Head and shoulders, both solid, no holes at all — the cleanest shape in the set for this system. The bust is a drawn half-ellipse via `_arc`, not a filleted rectangle                                                                                                                                                                                                 |
