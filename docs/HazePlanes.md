# HazePlanes

`src/HazePlanes/index.jsx`. Wraps content in the cocoon haze: the plane recession the logo and the icon set are cut from, applied to a live element. The scene is `src/utils/hazePlanes.js` (`docs/hazePlanes.md`); the component restates none of it. Built from `HazePlanes.spec.md`; `HazePlanes.resolved.md` records what the build settled.

```jsx
import { HazePlanes, CocoonIcon } from 'cocoon-ai'

<HazePlanes>Heading</HazePlanes>
<HazePlanes fan><CocoonIcon name="settings" size={48} /></HazePlanes>
<HazePlanes mode="shadow" cornerRadius={8} style={{ width: 80, height: 80 }}>block</HazePlanes>
<HazePlanes paint="both" surface="#141414" ink="#FFFFFF"><button>dark button</button></HazePlanes>
```

## Props

The scene, in the util's terms. Defaults are the shipped mark's.

| prop                | default              |                                                                   |
| ------------------- | -------------------- | ----------------------------------------------------------------- |
| `planes`            | 4                    | copies, the element's own face included                           |
| `depth`             | 2/3                  | the last plane's size as a fraction of the face                   |
| `radius`            | 0.6333               | the last plane's centre from the face's, in element widths        |
| `angle`             | 0                    | degrees; 0 right, 90 down, as CSS rotates. The mark recedes right |
| `perspective`       | 1/6                  | foreshortening of the middle planes; 0 is equal steps             |
| `cut`, `haze`       | `'vapour'`           | `'vapour'` or `'dense'`, or a raw transmittance total             |
| `surface`, `ground` | `#141414`, `#FFFFFF` | the face's colour and the colour behind the element; hex          |
| `ink`               | = `ground`           | the content's colour under `paint="both"`; hex                    |

How it is painted and how it behaves.

| prop                                  | default             |                                                                                                                  |
| ------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `mode`                                | `'transform'`       | `'transform'`, copies of the children; `'shadow'`, one box-shadow. The old names element, text and box throw     |
| `paint`                               | `'auto'`            | `'color'`, `'background'` or `'both'`; auto is color. Transform mode only                                        |
| `cornerRadius`                        | 0                   | any CSS length, a number meaning px; the wrapper's border radius and the shadow geometry's                       |
| `fan`                                 | `false`             | `true` or `'both'`, `'xy'`, `'z'`: planes coincide with the face at rest and open on hover or focus              |
| `duration`, `easing`                  | `'260ms'`, `'ease'` | the transition; any CSS time and timing function, `ease-in`, `ease-out`, `ease-in-out`, `linear`, a cubic-bezier |
| `className`, `style`, `ref`, the rest |                     | onto the wrapper `<span>`; `style` merges last                                                                   |

## The two mechanisms

**`transform`, the default.** The children are rendered once per plane, each copy moved along the angle and scaled about its own centre, then the real content on top. Exact for any shape and any aspect, including SVG and type on a transparent ground. Costs `planes − 1` extra nodes. The copies are `aria-hidden`, unselectable and inert to the pointer, so they stay out of the accessibility tree, out of a selection and out of the way of clicks. They carry the children's markup, so **the children must not carry element ids**: a duplicated id resolves every reference to the first copy, which is a plane.

**`shadow`.** One `box-shadow` with a layer per plane on the wrapper, which takes the face's tone as its background. No extra nodes and nothing that can interfere with the content's own markup, but exact only on a square: a spread is an outset by one amount on all four sides, a plane is a scale, and they agree only when width equals height. Off square the far plane is `(1 − S)·|W − H|` px wrong, and a plane vanishes entirely once the aspect passes `1/(1 − S)`. In development the component warns when it is used off square and when a plane is hidden.

## Paint

`color` recolours the copy's text and any `currentColor` artwork, which is what `CocoonIcon` files are cut for. `background` fills the copy's box. `both` does both, with two ramps: the box fades from `surface` toward `ground` and the content from `ink` toward `ground`, so a dark button with white text fades as a whole and its text stays legible on its own box. With one ramp the content would take its box's tone and vanish, which is what the first version did.

## The fan

At rest every plane sits exactly on the face, at translate 0 and scale 1, so it is occluded rather than faded; nothing animates opacity. On hover or focus the planes open. `'both'` animates displacement and size together. `'xy'` animates the displacement only, the copies already at their final size. `'z'` animates the size only, the copies already at their final displacement. The axis not animated snaps to its open value at the moment of opening. A change of `fan` closes the planes.

If nothing inside can take focus, the wrapper takes a tab stop, so the fan is reachable from a keyboard; the scan reruns when the subtree mutates, so a child that becomes focusable later hands the stop back. Under `prefers-reduced-motion: reduce` the duration is 0.

## First paint

The element is measured after layout with a ResizeObserver, because `radius` is in element widths. Before the first measurement there are no planes; they appear on the next paint and follow every resize, font swap and container query. Server markup carries no planes.
