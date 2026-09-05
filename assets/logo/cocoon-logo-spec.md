# cocoon — logo specification

**Current cut: wght 350 / wdth 107**, with the four-triangle icon at its left.
This supersedes the 217/107 wordmark and both earlier icons.

Everything below is in **design units**. The files are unitless SVG, so any
consistent scale works; only the ratios matter.

---

## 1. Typeface and variable-axis settings

|                         |                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| Family                  | **Saira** (Google Fonts, OFL)                                                 |
| File                    | `Saira-VariableFont_wdth,wght.ttf` — the variable font, not a static instance |
| Weight axis (`wght`)    | **350**                                                                       |
| Width axis (`wdth`)     | **107**                                                                       |
| Axis ranges in the font | `wght` 100–900, `wdth` 50–125 — both values sit inside, no clamping           |
| Units per em            | 1000                                                                          |

The wordmark is produced by instancing the variable font at exactly those two
coordinates and converting to outlines. It is **not** live text — reproducing it
from the font requires the same instance, then the modifications below.

Derived constants at this instance:

|                         |                                                                               |
| ----------------------- | ----------------------------------------------------------------------------- |
| Stem (vertical strokes) | **71.1**                                                                      |
| Stroke (horizontals)    | **60.3**                                                                      |
| x-height band           | **526** (y = −518 to y = 8; the round letters overshoot 8 below the baseline) |
| Letters                 | `c`, `o`, `n` unmodified; the two adjacent `o`s replaced by the infinity mark |
| Advances                | c **478**, o **601**, n **625**                                               |
| Side bearings           | c 70, o 70, n 94; the mark carries 75 each side                               |
| Total ink               | **3128.56 × 526**                                                             |
| viewBox                 | `70.31 −518.00 3128.56 526.00` — artwork bounds, zero padding                 |

---

## 2. The infinity mark

The two adjacent `o`s are replaced by a single self-crossing closed ribbon
(a lemniscate), drawn as one filled path with the **nonzero** fill rule.

### 2.1 Parameters at this instance

|                             |                                                                        |
| --------------------------- | ---------------------------------------------------------------------- |
| Loop profile                | superellipse, exponent **n = 3.5**                                     |
| Semi-axes                   | a = **194.5**, b = **232.8** (the `o`'s own centreline)                |
| Loop centre separation (2D) | **501.9** (D = 250.9 each side of centre)                              |
| Inner wedge (eps)           | **65°** — the `o` arc covers 230° of each loop                         |
| Corner fillet radius        | **138.1**                                                              |
| Straight run                | through the mark centre at **69.9°** from horizontal                   |
| Crossing angle              | **40.2°** between the two runs                                         |
| Weave gap                   | **45** units, straight bevel cut parallel to the positive-slope stroke |
| Mark ink width              | **961.9**; advance **1111.9** (mark + 75 each side)                    |

The positive-slope stroke passes over unbroken; the negative-slope stroke is cut
on both sides of it.

### 2.2 How the ribbon is drawn

**The pen.** The whole ribbon is one centreline swept with an _elliptical pen_,
semi-axes `stem/2` horizontal by `stroke/2` vertical (35.6 × 30.2 here). That
pen is what reproduces the `o` exactly: `a + stem/2` at the sides,
`b + stroke/2` top and bottom, and the `o`'s own counter. Every width in the
mark falls out of it — nothing is stroked at a constant thickness.

**The `o` keeps its width before it leaves.** Each loop runs as an unmodified
superellipse arc for the full 230° (eps = 65°). The departure toward the other
loop only begins after that, so the loops still read at the `o`'s width rather
than being pinched by the crossing.

**Corner fillets.** Where the loop arc meets the straight run through the
centre, a raw join leaves a visible point. Both corners are filleted at
0.71 × a, tangent to the loop arc at eps and to the straight run. The fillet
radius is what sets the angle of the run: the run is the common tangent from the
mark centre to the fillet circle. A straight chord between the two arc ends
instead would sit at 59° and give the pointed corners.

**The separators come last.** The weave gap is cut _after_ the ribbon is
complete — the shape is drawn as if the ribbon really crossed itself, then the
negative-slope stroke is trimmed back on both sides of the positive-slope one.
The two cut lines are parallel to the over-stroke, each `45 + half the
over-stroke's thickness` from its axis, so the bevels read as clean parallel
separators rather than as an end cap on the under-stroke.

The gap is held at a **flat 45 units** at every weight. Scaling it with the stem
was considered and rejected: at 350 a proportional gap (66) opens the crossing
far enough that the mark reads as broken rather than woven.

### 2.3 Re-deriving the mark at another instance

Everything scales off the instanced `o`, so the mark can be rebuilt at any Saira
instance without redrawing it:

    stem   = (o outer width  - o counter width ) / 2
    stroke = (o outer height - o counter height) / 2
    a      = (o outer width  - stem)   / 2
    b      = (o outer height - stroke) / 2
    D              = 1.2903 x a
    fillet radius  = 0.71   x a
    weave gap      = 45 units (flat)

`cocoon_wordmark.py` in this folder implements exactly this; `build_wordmark(
font, wght, wdth)` returns the composed outlines for any instance.

---

## 3. Minimum size

| Asset    | Holds down to   | Limiting feature                    |
| -------- | --------------- | ----------------------------------- |
| Wordmark | **~44 px wide** | the 71-unit stem falling below 1 px |

The heavier cut buys real headroom here — the 217 wordmark bottomed out around
63 px. Below ~44 px the stems and the weave gap start to fill in; at that point
use a dedicated small-size cut rather than this artwork scaled down.

---

## 4. Colour

Single colour throughout, `#141414`. The wordmark is one filled path using the
**nonzero** fill rule. Reversed, it is the same path in the paper colour on a
`#141414` ground — no separate artwork needed.

**In a lockup the wordmark participates in the cut.** It is the same material as
the mark's near plane, at the same depth, with no atmosphere between it and the
camera — so it takes **plane 0's tone**, not a restatement of it. That is
`#141414` for both cuts unreversed, `#FFFFFF` for vapour reversed, and
**`#E8E8E8` for dense reversed**. `cocoon_lockup.py` reads the value off the
icon's own front plane so the two cannot drift apart.

A wordmark set **alone** has no cut, because a cut is a property of the icon's
atmosphere and there are no planes to have any. Standalone reversed artwork
therefore takes pure paper, `#FFFFFF`.

---

## 5. Files

The icon ships in two cuts of the same geometry, differing only in how thick the
atmosphere is: **vapour** (the default) and **dense** (see 6.4). Every file
names its cut.

| File                                                                                   | Contents                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `cocoon-wordmark.svg`                                                                  | The wordmark, 3128.56 × 526, one path                                     |
| `cocoon-wordmark.png`                                                                  | 1800 px preview                                                           |
| `cocoon-icon-vapour.svg`                                                               | The icon, 1247.87 × 743.14, four paths                                    |
| `cocoon-icon-vapour-square.svg`                                                        | Same artwork centred on a square canvas                                   |
| `cocoon-icon-vapour-reversed.svg`                                                      | For dark grounds                                                          |
| `cocoon-icon-dense.svg`                                                                | The dense cut                                                             |
| `cocoon-icon-dense-square.svg`                                                         | Dense, square canvas                                                      |
| `cocoon-icon-dense-reversed.svg`                                                       | Dense, reversed                                                           |
| `cocoon-icon-vapour.png`, `cocoon-icon-dense.png`                                      | 1400 px previews                                                          |
| `cocoon-favicon.svg`                                                                   | Dark mark on a light rounded tile                                         |
| `cocoon-favicon-reversed.svg`                                                          | Light mark on a `#141414` rounded tile                                    |
| `cocoon-favicon.png`                                                                   | 512 px preview                                                            |
| `lockups/cocoon-lockup-icon{0.90,1.00,1.10}-air{1,2,3}x-{vapour,dense}[-reversed].svg` | 36 combinations                                                           |
| `cocoon-lockup.png`                                                                    | 2000 px preview of 1.00× / air2x / vapour                                 |
| `cocoon-logo-spec.md`                                                                  | This document                                                             |
| `cocoon_wordmark.py`                                                                   | Generator — rebuilds the wordmark at any Saira instance                   |
| `cocoon_icon.py`                                                                       | Generator — renders the icon and favicons from the 3D scene               |
| `cocoon_lockup.py`                                                                     | Generator — composes any size/gap lockup                                  |
| `build_v3.py`                                                                          | Regenerates every derived file above; asserts the plain icons do not move |
| `Saira-VariableFont_wdth,wght.ttf`                                                     | The source font (OFL, licence included)                                   |

---

## 6. Icon

Four **congruent** isosceles triangles standing in a row in 3D and seen through
a perspective camera. They are the same size and the same colour; they read
smaller and lighter purely because they are further away.

### 6.1 The triangle

The two **equal sides are the top and right edges**. They meet at the top-right
vertex, which is therefore the sharp one, so the shape points **up and to the
right**. The remaining, shorter, left edge is the base.

|                                     |                                               |
| ----------------------------------- | --------------------------------------------- |
| Equal sides (top, right)            | **1000**                                      |
| Base (left edge)                    | **813.47** — the equal sides are 22.9% longer |
| Angle at the sharp top-right vertex | **48°**                                       |
| Angles at the other two vertices    | **66°** each                                  |
| Top edge                            | horizontal                                    |

At 48° the base is `2·sin(24°) = 0.8135` of a side. Setting that angle to 60°
reproduces the earlier equilateral mark exactly, which is the regression test.

### 6.2 The camera

The image plane is held **parallel to the triangles** — a shift, or
perspective-control, camera. This is the whole reason all four stay exactly
congruent in projection; a camera rotated to aim down the row would keystone
them.

All distances are in equal-side lengths, `s`.

|                                      |                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Camera to front triangle             | **6s**                                                                    |
| Spacing between triangles            | **1s**                                                                    |
| Camera offset, right of the row axis | **1.30s** (12.2° off axis)                                                |
| Camera height                        | **on the centroid line** — the row is level, neither climbing nor falling |
| Front triangle's angular size        | 9.53° — a long lens, which is why the recession is calm                   |

### 6.3 What the projection gives

`S_k = 6s / (6s + k·1s)`, so the four scales are exactly **1 : 6/7 : 3/4 : 2/3**.
The steps are 0.857, 0.875, 0.889 — decelerating, which is the signature of real
perspective rather than a geometric series.

| k   | side     | centroid x | centroid y | corner r |
| --- | -------- | ---------- | ---------- | -------- |
| 0   | 1000.000 | −1300.000  | 0          | 20.000   |
| 1   | 857.143  | −1114.286  | 0          | 17.143   |
| 2   | 750.000  | −975.000   | 0          | 15.000   |
| 3   | 666.667  | −866.667   | 0          | 13.333   |

Artwork bounds `viewBox="-1743.62 -247.71 1247.87 743.14"` — **1.679 : 1**.
`cocoon-icon-*-square.svg` squares that canvas **about the front triangle's
centre** (§6.8), growing the side until every triangle still clears a 60-unit
margin: `1615.75 × 1615.75`, against `1367.87` when the box was squared about
its own centre.

### 6.4 Corners

Every corner is filleted at **r = 0.02 × that triangle's own equal side**, so
the radius scales with the projection exactly as a physical rounding would. The
fillets are **convex** — tangent to both edges and bulging out toward the vertex
they replace.

The check, if the arcs ever look wrong: a convex fillet removes exactly
`r·t − ½r²(π − θ)` per corner, with `t = r/tan(θ/2)` and θ the interior angle.
For this triangle (48°/66°/66°, r = 80 on a 1000 side) that is 3.36% of the
area; an inverted SVG sweep flag gouges a concave bite of 9.29% instead. Measure
the area, don't reason about handedness.

### 6.5 Colour — aerial perspective, not four greys

Each triangle is the same surface under the same light, so each leaves the same
radiance. What differs is the atmosphere between it and the camera, which
absorbs that radiance and substitutes its own:

    L_k = L_surface · T^k + L_haze · (1 − T^k)

The mix is done in **linear light** and only then encoded to sRGB — compositing
in gamma space is the usual reason distant objects come out too dark.

`T` is derived, not chosen. The row's **total** haze is held at the value the
earlier three-triangle mark carried, so the front and back triangles keep
exactly the tones they had and the atmosphere is simply thinned to spread that
total over three gaps instead of two:

    T = (T_old²)^(1/3)      vapour: 0.275² → T = 0.422885
                            dense:  0.15²  → T = 0.282311

| cut                  | haze      | T      | k=0       | k=1       | k=2       | k=3       |
| -------------------- | --------- | ------ | --------- | --------- | --------- | --------- |
| **vapour** (default) | `#FFFFFF` | 0.4229 | `#141414` | `#C8C8C8` | `#EAEAEA` | `#F6F6F6` |
| vapour reversed      |           |        | `#FFFFFF` | `#AFAFAF` | `#777777` | `#515151` |
| **dense**            | `#E8E8E8` | 0.2823 | `#141414` | `#C9C9C9` | `#E0E0E0` | `#E6E6E6` |
| dense reversed       |           |        | `#E8E8E8` | `#858585` | `#4B4B4B` | `#2C2C2C` |

Vapour's back triangle at `#F6F6F6` is deliberately at the edge of visibility:
it reads on a white screen and disappears anywhere else. **Use dense for print,
for off-white grounds, and below about 32 px.**

### 6.6 Lockup

The icon sits at the **left** of the wordmark. Both anchors are expressed in the
wordmark's own units, so the rule survives any rescaling.

|                    |                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Icon size          | its **total height** as a multiple of the wordmark's x-height band (526)                                           |
| Vertical alignment | the icon's vertical extent **centred on the x-height band** (band centre y = −255)                                 |
| Clear air          | the least space between the **nearest ink** and the wordmark, in **wordmark stems (71.1)**. Ships at 1×, 2× and 3× |
| Anchor             | the **front triangle's right edge** — see §6.8                                                                     |

**Two things have to hold at once, and they pull against each other.**

1. The **black triangle** must sit a constant distance from the wordmark. It is
   what reads as the mark, so if that distance drifts, the three icon sizes are
   not the same lockup at three scales.
2. The **nearest ink** must not crowd the wordmark. The trail is faint but not
   invisible — the second plane is `#C8C8C8` on white — and a pale wedge close
   to a letterform reads as a collision.

They conflict because the trail's length _in stems_ scales with the icon:
**2.221 / 2.468 / 2.714 stems** at 0.90 / 1.00 / 1.10×. Anchor on the bounding
box and (2) is constant while (1) drifts; anchor on the front triangle and (1)
is constant while (2) varies.

**(2) is the binding constraint**, so it sets the value and (1) sets the anchor.
Crowding is a near-miss violation — visible in a single lockup, with nothing to
compare against. The black triangle's distance drifting is only detectable with
two lockups side by side, which almost never happens. A defect visible alone
beats one visible only in comparison.

**The rule.** Tiers are named by the clear air they guarantee. The gap that
delivers it is derived, not chosen:

    gap = air + trail_worst()      the trail at the LARGEST shipped icon size
        rounded UP to the quarter stem — up, never down, so the rounding
        cannot put a tier under its own floor

`trail_worst()` is computed in `build_v3.py` from the artwork and `SIZES`; it is
not a constant in this document. At the sizes shipped today it is **2.714357**,
which is why the table below reads as it does — but the table is _output_, not
input. Add a larger icon size and every gap moves.

| tier      | front-edge gap | clear air, 0.90× → 1.10× |
| --------- | -------------- | ------------------------ |
| **air1x** | 3.75 stems     | 1.529 → **1.036**        |
| **air2x** | 4.75           | 2.529 → **2.036**        |
| **air3x** | 5.75           | 3.529 → **3.036**        |

Those gaps are what `gap_for()` returns at the current `SIZES`; `build_v3.py`
fails if this table and the generator disagree.

Measured back out of all 36 finished files, every tier clears its floor.

Three tiers rather than two because the criterion generates a family and the
files are cheap; anything below air1x is excluded, not omitted — at 0.79 stems
the trail visibly touches the "c" at the 1.10× size.

**Which icon cut.** Use **vapour above about 400 px of lockup width** and
**dense below it**. In a lockup the icon is only about a fifth of the total
width, so vapour's rear triangles fall under a pixel long before the wordmark
does.

#### 6.6.1 The decision trail, and what would change it

Recorded because the resolution is not self-evident from the numbers, and
because two of the four candidates below looked right until they were measured
at the largest icon size.

| candidate                          | black triangle                                             | nearest ink to the "c"    | why rejected                                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bounding-box anchor** (original) | drifts **3.221 → 3.714** stems across the three icon sizes | constant 1.000            | The three sizes are not the same lockup at three scales. The 2×/3× tiers had already been recalibrated to 1×/2× to absorb the drift, which centres the error without removing it                                 |
| **front anchor, gap 3.00**         | constant                                                   | **0.779 / 0.532 / 0.286** | Collides. At 1.10× the pale wedge touches the "c". Chosen for roundness and then warranted with the retired three-triangle mark's 3.07 — a reason found _after_ the choice and written up as though it caused it |
| **front anchor, gap 3.50**         | constant                                                   | 1.279 / 1.032 / **0.786** | Preserves the air the 1.00× tier happened to have, so it looks right at the reference size and fails at 1.10×. Reference-size reasoning hides the binding case                                                   |
| **front anchor, air-derived**      | constant                                                   | ≥ **1.036** at every size | Shipped                                                                                                                                                                                                          |

**Where the floor comes from: the wordmark's own letterspacing.** The gap is
derived from the air floor, so the floor carries the whole rule. It is not a
stipulation and it is not inherited from the retired bounding-box rule — that
rule happened to land on the same value for the same underlying reason.

Letterspacing is the solved instance of this exact problem: how far apart do two
ink shapes sit so they read as separate marks within one object. A type designer
answered it for this typeface at this instance. The lockup asks it again with
the icon as one more glyph, so the unit is the wordmark's own letter gap.

Measured ink-to-ink between adjacent glyphs in `cocoon-wordmark.svg`:

| c → o  | o → c  | c → mark | mark → n | mean             |
| ------ | ------ | -------- | -------- | ---------------- |
| 122.90 | 141.00 | 127.60   | 168.90   | **140.10 units** |

The mean matches what the side bearings in §1 predict (c 70 + o 70 = 140.00) to
a tenth of a unit, which is the check that the measurement is reading real ink.
In stems, the letter gap is **1.970** — which is why the stem worked as a proxy,
and why it was never the reason.

| tier      | air     | as a multiple of the letter gap                                                    |
| --------- | ------- | ---------------------------------------------------------------------------------- |
| **air1x** | 1 stem  | **0.507 ×** — half the wordmark's own tracking                                     |
| **air2x** | 2 stems | **1.015 ×** — the icon sits off the word exactly as the letters sit off each other |
| **air3x** | 3 stems | **1.522 ×**                                                                        |

So the tiers are ½, 1 and 1½ letter gaps to within 1.5%, and `air2x` is the
setting at which the lockup reads as one object rather than two adjacent ones.
Tiers stay expressed in stems because the gap formula is in stems and mixing
units inside one formula costs more than the 1.5%.

This also explains the rejected setting: 0.79 stems is **0.40 letter gaps** —
tighter than half the wordmark's own tracking, so the icon does not merely sit
close to the "c", it begins to fuse with it the way over-tracked letters do.

**What is still untested.** The _mechanism_ offered for why fusion is bad — the
trail is a depth cue, the wordmark asserts the same depth plane as the black
triangle, and adjacency with no occlusion boundary leaves the eye two
incompatible depth claims to arbitrate — is a descriptive claim. It is
computable, but only by going and looking at how people read the mark at varying
air. Nobody has. The floor above does not depend on it; the letterspacing
derivation stands on its own.

**The hinge, and it is an artistic call, not a measurement.** All of the above
assumes a pale trail approaching a letterform is a defect. It could instead be
read as the mark's atmosphere meeting the word — deliberate, and the tighter
setting does look more assured at large sizes. If that is the reading, the floor
drops and `air1x` becomes something nearer 0.5 stems. The spec takes the
conservative side because the lockup is used small far more often than large,
and near-miss crowding is one of the things the eye is built to flag.

**What would move these numbers.** The gaps are `air + TRAIL_WORST` where
`TRAIL_WORST` is the trail length in stems at the _largest_ shipped icon size.
So they change if:

- **a larger icon size is added.** `TRAIL_WORST` scales linearly with icon size;
  a 1.20× tier would put it at 2.961 and push every gap up a quarter stem.
- **the haze gets denser.** The floor exists because the second plane is
  `#C8C8C8` and visible. A thicker atmosphere makes it fainter and the floor
  could fall; a thinner one makes it darker and the floor must rise.
- **the number of planes changes.** Four planes set the trail at 0.248 of the
  mark's width; three or five would change it and `TRAIL_WORST` with it.

`build_v3.py` derives the gaps from `TRAIL_WORST` and `AIR_TIERS`, so changing
either regenerates the whole family consistently rather than needing 36 files
edited by hand.

### 6.7 Favicon

The icon centred on a rounded square, in two versions with opposite grounds.

|               |                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tile          | 1000 × 1000, corner radius **220** (carried over from the retired favicon)                                                                                                                                                                             |
| Icon size     | the **front triangle's** larger dimension, centred both ways (§6.8)                                                                                                                                                                                    |
| Clear air     | **10%** of the tile from the edge to any ink — the stated rule; the size above is **derived** from it, and comes out at **53.5%** of the tile. Was 84% of the whole four-triangle box, which put the black triangle 83 units left of the tile's centre |
| Light version | mark as normal on a `#F7F6F2` ground — off-white rather than pure white so the tile keeps an edge against white browser chrome                                                                                                                         |
| Dark version  | reversed mark on a `#141414` ground                                                                                                                                                                                                                    |
| Cut           | **dense**, in both — a favicon is a small-size object by definition                                                                                                                                                                                    |

Below about 24 px the fourth triangle is gone and the third is marginal; the
mark still reads as a triangle with depth, which is the point. If a true 16 px
cut is ever needed it should be a separate simplified drawing — two triangles,
heavier separation — rather than this artwork scaled down.

### 6.8 Anchoring — the front triangle, not the bounding box

**Anything that centres or spaces the mark anchors on the front triangle.** The
four-triangle bounding box ends at the fourth triangle's tip, and that triangle
is `#F6F6F6` — it reads on a white screen and disappears anywhere else. Centring
on the box therefore hands a quarter of the mark's measured width to ink nobody
sees, and pushes the black triangle off centre by exactly that much.

Three consequences, and they are the whole of the rule:

| asset                      | anchored on                       | effect of the change                                                         |
| -------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `cocoon-icon-*-square.svg` | front triangle's centre           | canvas grows 1367.87 → 1615.75 so the trail still clears the 60-unit margin  |
| `cocoon-favicon*.svg`      | front triangle, sized and centred | the black triangle moves 83 units right, onto the tile's centre              |
| `lockups/*`                | front triangle's right edge       | visible air becomes constant at 3 or 4 stems instead of drifting 3.22 → 3.71 |

**Vertical anchoring never changes.** The row is level and the front triangle is
the largest, so the front triangle's vertical extent _is_ the whole mark's. The
lockup's `size` anchor and its vertical centring were already on the front plane
without anyone having to say so; only horizontal anchors move.

**The plain icon files are untouched.** `cocoon-icon-{vapour,dense}[-reversed].svg`
are tight to the artwork and carry no centring rule, so there is nothing in them
for this to change. `build_v3.py` asserts that they come out byte-identical —
they are also what the icon set's `check_cocoon.py` regression compares against,
so a change here would break that silently.

This is the same rule the **cocoon icon set** applies to its tiles, and for the
same reason: at small sizes the front plane is all that survives, so it is what
the eye checks for centring. The favicon uses the icon set's tile geometry
exactly — 1000 × 1000, radius 220, 10% clear air — so it sits in a row of UI
tiles without looking like a different system.

### 6.9 Rebuilding a lockup from the two files

1. Place `cocoon-wordmark.svg`.
2. Scale the icon so its **total height** is 0.90 / 1.00 / 1.10 × the
   wordmark's x-height band (526).
3. Move the icon so its vertical extent is centred on that band.
4. Set the horizontal gap from the **black triangle's right edge** to the
   wordmark's bounding box to `air + trail_worst()` stems, rounded up to the
   quarter stem — 3.75, 4.75 or 5.75 at the sizes shipped today, for 1, 2 or 3
   stems of clear air. Measured to the
   black triangle, not to the icon's bounding box — see §6.8.

`cocoon_lockup.py` does exactly this: `lockup(size, gap_stems, reverse,
icon_kw)` returns the composed SVG.

---

## 7. Change log

**From 217/107 to 350/107.** Feedback favoured the wordmark and retired the
icon. Sixteen cuts were generated across wght 100–500 × wdth 75–125, each with
the mark rebuilt from that instance's own `o`; 350/107 was chosen.

**Corrections to the previous spec.** Rebuilding the 217 wordmark from the font
and matching it against the shipped artwork (96.4% pixel IoU) turned up two
gaps in the old document, both fixed above:

- The **corner fillets and the separator order** were not recorded at all.
  Without the fillets the loop-to-crossing joins come to points.
- The **crossing angle was given as 60.7°**; measured off the artwork it is
  40.2°, with the straight run at 69.9° from horizontal.

The old spec's "apex arch blend 1.0" line is not needed: a plain superellipse at
n = 3.5 tracks the real `o` closely enough that no apex blending is applied.

**The icon.** Three triangles in a row through a shift camera, replacing the
retired cocoon mark. The projection was checked against a full
`PerspectiveCamera` → projection-matrix → NDC pipeline: the closed form in
`cocoon_icon.py` agrees to 1e-13, and all three projected triangles are
equilateral to the same tolerance.

**The lockup.** Icon left of the wordmark, sized against the x-height band and
gapped in wordmark stems, so both anchors scale with the logo rather than being
fixed in absolute units.

**The wordmark now participates in the cut.** The reversed wordmark fill was
hardcoded to `#FFFFFF` regardless of cut, so a dense-reversed lockup put a pure
white wordmark beside an `#E8E8E8` mark — two different whites, adjacent, on a
dark ground, 23/255 apart. It now takes the icon's plane-0 tone, read off the
icon rather than restated. Only dense-reversed changes; the other three cuts
were already correct. Found by rendering all four cuts of a lockup after a
change that had nothing to do with colour — the defect predated it.

**Anchoring moved to the front triangle.** Everything that centres or spaces
the mark used to anchor on the four-triangle bounding box, which ends at the
`#F6F6F6` fourth triangle — invisible ink that was nonetheless being measured.
The favicon had the black triangle sitting 83 units left of the tile's centre;
the lockup's visible air drifted from 3.22 to 3.71 stems across the three icon
sizes while the nominal gap stayed put. All three centring assets now anchor on
the front triangle (§6.8): the square canvas grows to 1615.75, the favicon's
size is derived from a stated 10% clear-air floor rather than picked, and the
lockup gaps become a constant 3× and 4× stems, replacing the 1×/2× that had been
recalibrated to absorb the drift. The four plain icon files are unchanged and
`build_v3.py` asserts it. This matches the rule the cocoon icon set uses for its
tiles, arrived at there independently and for the same reason: at small sizes
the front plane is all that survives.

**Final icon.** Four triangles instead of three, and isosceles instead of
equilateral — the two equal sides are the top and right edges, so the sharp
vertex is top-right and the mark points up and to the right. The camera moved
out to 1.30s and onto the centroid line, so the row is level. Total haze was
held constant while the atmosphere thinned to cover the extra gap, which is why
the front and back triangles are unchanged. Favicons added; the lockup gap was
recalibrated by one stem to absorb the wider, near-invisible bounding box.
