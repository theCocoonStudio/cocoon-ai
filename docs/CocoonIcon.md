# CocoonIcon

`src/CocoonIcon/index.jsx`. A cocoon icon at text size, in text colour. Built from `CocoonIcon.spec.md`; `CocoonIcon.resolved.md` records what the build settled.

```jsx
import { CocoonIcon } from 'cocoon-ai'

<CocoonIcon name="settings" />                  // the surrounding text's size and colour
<CocoonIcon name="settings" size={24} />        // 24 px regardless of text
<CocoonIcon name="settings" size="1.5em" />     // any CSS length
<CocoonIcon name="settings" color="#B4442E" />  // any CSS colour
<CocoonIcon name="menu" title="Open menu" />    // announced to screen readers
<CocoonIcon><svg viewBox="0 0 10 10">…</svg></CocoonIcon>
```

## Props

| prop                                  | type                      | default |                                                       |
| ------------------------------------- | ------------------------- | ------- | ----------------------------------------------------- |
| `name`                                | one of `iconNames`        |         | omit when passing a child                             |
| `children`                            | one inline `<svg>`        |         | used when `name` is absent; sized to fill the box     |
| `size`                                | number (px) or CSS length | `1em`   | omitted, the icon is the font size                    |
| `color`                               | CSS colour                | inherit | omitted, it takes the text colour                     |
| `title`                               | string                    |         | accessible name; omitted marks the icon `aria-hidden` |
| `style`, `className`, `ref`, the rest |                           |         | onto the wrapper `<span>`; `style` merges last        |

Both defaults are the point: an icon dropped beside a word matches that word without being told anything. That works because of how the files are cut, a square viewBox, no margin, every fill `currentColor`, so the wrapper's size is the icon's size and no per-icon nudging exists anywhere.

A `name` that does not exist throws, listing the names that do, and so does a call with neither a name nor a child. A blank where an icon should be is a bug found in a screenshot three days later.

## The icons

`iconNames` is the 13 names of the icon set, `icons` maps each to an `<svg>` component. Both come from `src/CocoonIcon/icons.js`, which `npm run assets:icons` generates from the set's square files as path data. No SVG loader is involved on either side, and a test fails if the module and the files disagree. Adding an icon is a change to `assets/icons/shapes.js` and a rebuild; nothing in the component changes.

## Layout

The wrapper is `inline-flex`, `flex: none`, `line-height: 1`, with `vertical-align: -0.125em`, which sits the icon on the text's optical centre rather than its baseline, as icon fonts do. Override any of it through `style`.
