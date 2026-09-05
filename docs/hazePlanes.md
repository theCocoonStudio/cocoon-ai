# hazePlanes

`src/utils/hazePlanes.js`. The cocoon four-plane recession as a scene, and the CSS that expresses it. React-free. Not exported from the package; `HazePlanes` and the asset generators import it directly.

The logo, the icon set and the `HazePlanes` component all draw the same picture: a row of identical copies standing one behind another, seen by a shift camera off to one side, through haze. This module holds that scene once. The constants in `HAZE_DEFAULTS` and `HAZE_CUTS` are the ones the logo spec derives; change them here and the assets rebuild differently, which their tests will say.

## The model

Every input names something in the scene. Nothing is a CSS quantity.

```
S_k    = distance / (distance + k · spacing)     projected size of plane k
spread = -(1 - S_k) · width / 2                  shrink the box
offset =  cameraX · (1 - S_k) · width            slide it toward the axis
L_k    = L_surface · T^k + L_ground · (1 - T^k)  mixed in linear light
T      = haze^(1 / (planes - 1))
```

Distances are in element widths, so a scene survives any resize. At the house scene the scales are exactly 1 : 6/7 : 3/4 : 2/3.

| lever                       | default                               | reach for it when                                                |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `planes`                    | 4                                     | more or fewer copies                                             |
| `spacing`                   | 1                                     | too flat or too busy                                             |
| `distance`                  | 6                                     | the first step swamps the rest                                   |
| `cameraX`                   | 1.3                                   | copies barely peek out, or crowd. Must exceed 0.5 for box-shadow |
| `haze` or `cut`             | `vapour` (0.275²), or `dense` (0.15²) | fade too fast or too slow                                        |
| `surface`, `ground`         | `#141414`, `#FFFFFF`                  | the element and the real colour behind it                        |
| `width`, `height`, `radius` | 48, = width, 0                        | the subject, in px                                               |

## API

- `hazeResolve(opts)` fills defaults and validates. `cut` sets `haze` by name.
- `hazeTones(opts)` returns one hex per plane, near plane first, mixed in linear light.
- `hazeAnalyse(opts)` returns per-plane `scale`, `offset`, `spread`, the two box-shadow errors, `clears`, plus `tones`, `worstError`, `hidden` and `ok`.
- `hazeMaxSpacing(opts, px)` returns the widest spacing whose worst box-shadow error stays within a pixel budget.
- `hazeShadow(opts)` returns CSS text: a `box-shadow` rule where the geometry supports it within `tolerance`, otherwise a transform stack with markup in a comment. `technique`, `selector`, `responsive`, `precision` and `comment` shape the output.

## Why box-shadow is an approximation

A plane is the element scaled about the camera's principal point. A `box-shadow` spread is a uniform outset. They coincide only where an outset is a scale: on a square with sharp corners, or a full circle. Off square the far plane is short by `(1 - S)·|W - H|`; between `r = 0` and `r = W/2` the corner radius is wrong, worst near `W/6`. Both errors are proportional to `spacing`, so pulling the row together makes them small without making them go away. `hazeAnalyse` reports them; `hazeShadow` under `auto` switches to the transform stack when they exceed `tolerance`.

The transform stack has no `z-index`, deliberately. Pushing copies behind the element with a negative z-index fails two opposite ways depending on whether an ancestor isolates; siblings in back-to-front DOM order fail neither way.

## Tests

`hazePlanes.test.js` pins the four house ramps to the logo spec's tables, the closed-form geometry at the house scene, the two exact box-shadow conditions, the hidden-plane rule at `cameraX` 0.5, the spacing search, and the shape of both CSS outputs. The port was also checked byte for byte against the original generator across ten option sets before it replaced it.

## Ahead

- A three.js playground for the scene: the same parameters driving real planes and a real camera, so the CSS and the render can be compared side by side. Replaces the old HTML sliders page, which was not carried over.
