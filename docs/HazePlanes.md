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
| `fan`                                 | `false`             | `true`, or `{ xyz, size }`: planes are transparent at rest and open on hover or focus; see The fan               |
| `duration`, `easing`                  | `'260ms'`, `'ease'` | the transition; any CSS time and timing function, `ease-in`, `ease-out`, `ease-in-out`, `linear`, a cubic-bezier |
| `className`, `style`, `ref`, the rest |                     | onto the wrapper `<span>`; `style` merges last                                                                   |

## The two mechanisms

**`transform`, the default.** The children are rendered once per plane, each copy moved along the angle and scaled about its own centre, then the real content on top. Exact for any shape and any aspect, including SVG and type on a transparent ground. Costs `planes − 1` extra nodes. The copies are `aria-hidden`, unselectable and inert to the pointer, so they stay out of the accessibility tree, out of a selection and out of the way of clicks. They carry the children's markup, so **the children must not carry element ids**: a duplicated id resolves every reference to the first copy, which is a plane.

**`shadow`.** One `box-shadow` with a layer per plane on the wrapper, which takes the face's tone as its background. No extra nodes and nothing that can interfere with the content's own markup, but exact only on a square: a spread is an outset by one amount on all four sides, a plane is a scale, and they agree only when width equals height. Off square the far plane is `(1 − S)·|W − H|` px wrong, and a plane vanishes entirely once the aspect passes `1/(1 − S)`. In development the component warns when it is used off square and when a plane is hidden.

## Paint

`color` recolours the copy's text and any `currentColor` artwork, which is what `CocoonIcon` files are cut for. `background` fills the copy's box. `both` does both, with two ramps: the box fades from `surface` toward `ground` and the content from `ink` toward `ground`, so a dark button with white text fades as a whole and its text stays legible on its own box. With one ramp the content would take its box's tone and vanish, which is what the first version did.

## The fan

`fan` is `false`, `true`, or an object `{ xyz, size }`; `true` means `{ xyz: true, size: 'shrink' }`, and an object fills its missing keys from that. At rest every plane is transparent and sits at its start pose; on hover or focus it fades in and moves to its place, every animated quantity together in one transition.

- `xyz: true` starts each plane on the face's position; `false` leaves it at its own place throughout.
- `size: 'shrink'` starts each plane at the face's size and shrinks it to its own; `'grow'` starts it at nothing, at its own centre, and grows it; a falsy `size` keeps the final size throughout.

A change of `fan` closes the planes. Shadow mode has no fan: its layers cannot fade separately, so `fan` is ignored there and the planes stand open.

If nothing inside can take focus, the wrapper takes a tab stop, so the fan is reachable from a keyboard; the scan reruns when the subtree mutates, so a child that becomes focusable later hands the stop back. Under `prefers-reduced-motion: reduce` the duration is 0.

## First paint

The element is measured after layout with a ResizeObserver, because `radius` is in element widths. Before the first measurement there are no planes; they appear on the next paint and follow every resize, font swap and container query. Server markup carries no planes.
