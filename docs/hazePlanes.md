# hazePlanes

`src/utils/hazePlanes.js`. The cocoon plane recession as a scene, and the CSS that expresses it. React-free. Not exported from the package; `HazePlanes` and the asset generators import it directly.

The logo, the icon set and the `HazePlanes` component all draw the same picture: a row of copies of a shape standing behind it, each a step smaller and a step further along one direction, seen through haze. This module holds that scene once. The constants in `HAZE_DEFAULTS` and `HAZE_CUTS` are the ones the logo spec derives; change them here and the assets rebuild differently, which their tests will say.

## The model

There is no camera. The picture is orthographic: the shrinking is in the world, and the steps are where the parameters put them. Four numbers and a count reach every output, and none of them is redundant. That is the whole reason for this parametrisation; the one before it had two numbers, a camera distance and a plane spacing, that only ever entered as their ratio.

```
f(k)   = (1 - 1/(1 + k·p)) / (1 - 1/(1 + (n-1)·p))    where plane k sits, 0 at the face, 1 at the last
         k / (n-1) when p = 0
S_k    = 1 - (1 - depth) · f(k)                        size of plane k, as a fraction of the face
d_k    = radius · f(k) · width                         its centre's displacement from the face's
spread = -(1 - S_k) · width / 2                        the same size change as a box-shadow spread
L_k    = L_surface · T^k + L_ground · (1 - T^k)        tone, mixed in linear light
T      = haze^(1 / (planes - 1))
```

`radius` is in element widths, so a scene survives any resize. Every plane is the face scaled about its own centre and moved along `angle`.

| parameter                         | default                             | what it moves                                                                                                                                                    |
| --------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planes`                          | 4                                   | how many copies, the element's own face included                                                                                                                 |
| `depth`                           | 2/3                                 | the last plane's size as a fraction of the face; the planes between step evenly toward it                                                                        |
| `radius`                          | 0.6333                              | the last plane's centre from the face's centre, in widths                                                                                                        |
| `angle`                           | 0                                   | which way, degrees: 0 right, 90 down, as CSS rotates                                                                                                             |
| `perspective`                     | 1/6                                 | how the middle planes are spaced: 0 is equal steps; larger foreshortens, near steps long and far ones short, along the hyperbola a camera would give. One number |
| `haze` or `cut`                   | `vapour` (0.10), or `dense` (0.15²) | how much of the surface is left at the last plane; a cut names a preset                                                                                          |
| `surface`, `ground`               | `#141414`, `#FFFFFF`                | the element and the real colour behind it                                                                                                                        |
| `width`, `height`, `cornerRadius` | 48, = width, 0                      | the subject, in px; the corner radius is the box-shadow fidelity question below                                                                                  |

**Why these defaults.** `depth` 2/3 and `radius` 0.6333 are the last plane of the shipped mark: the camera the old model had at 6 shape-widths' distance and 1.90 widths' offset put the fourth triangle exactly there. `perspective` 1/6 is that camera's foreshortening, and it was kept after a sweep from 0 to 1/3 on the logo icon at 32 to 400 px, by this rule: the last step should be no shorter than half the first, or the tail clusters into one smear at 32 px, and no longer than three quarters, or the row reads as an even echo rather than a recession. That band is perspective 0.10 to 0.23; at 1/6 the last step is 0.58 of the first. At 1/6 the sizes are exactly 1 : 6/7 : 3/4 : 2/3 and the steps 3/7 : 3/4 : 1 of the radius.

## API

- `hazeResolve(opts)` fills defaults and validates. `cut` sets `haze` by name.
- `hazeProfile(k, planes, perspective)` is `f(k)` above.
- `hazeTones(opts)` returns one hex per plane, near plane first, mixed in linear light.
- `hazeAnalyse(opts)` returns per-plane `scale`, `offset`, `dx`, `dy`, `spread`, the box-shadow errors, which planes are hidden under the element, and `ok`.
- `hazeMinDepth(opts, px)` returns the shallowest depth whose worst box-shadow error stays within a pixel budget.
- `hazeShadow(opts)` returns CSS text: a `box-shadow` rule where the geometry supports it within `tolerance`, the transform stack otherwise, or either on request via `technique`. `responsive` emits lengths as `calc(var(--haze-w) * k)`. `comment: false` drops the header.

## Why box-shadow is an approximation

A plane is the element scaled about its own centre. A `box-shadow` spread is a uniform outset. They coincide only on a square with sharp corners, or a full circle. Off square the far plane is `(1 - S)·|W - H|` px wrong; with a corner radius between 0 and `W/2` the corners are wrong by `|S·r - max(0, r + spread)|`. `hazeAnalyse` reports both, `hazeShadow` picks the transform stack when they exceed `tolerance`, and the header comment says which it chose and why. The transform stack is exact for any shape and costs `planes - 1` extra elements.

## Tests

`hazePlanes.test.js` pins the four house ramps to the logo spec's tables, the profile at 0 and at 1/6, the closed-form geometry at the house scene, the angle convention, the two exact box-shadow conditions, the hidden-plane rule, the depth search, and the shape of both CSS outputs. The first port of this module was checked byte for byte against the original generator across ten option sets; this model replaced that one on 2026-09-06 and reproduces its geometry at perspective 1/6.

## Ahead

- A three.js playground for the scene: the four sliders live, on real content, so a change can be seen before it is committed. The old HTML sliders page was not carried over.
