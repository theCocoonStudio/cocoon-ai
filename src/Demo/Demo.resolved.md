# Demo — resolved

Written with the build, 2026-10-07, from the spec beside it, which came from the demo skill's REPL with Izzy the same day.

## contracts

- The sidebar's open state is controlled when `openSettings` is defined and owned by the toggle otherwise; `onOpenSettingsChange` fires with the next state either way (callbacks.1, callbacks.neg.1). Test: `callbacks.neg.1 with openSettings given the toggle changes nothing itself; the prop does`.
- `settings` must be what `useSettings` returned, and the hook is where the schema is validated; the wrapper checks the shape and throws naming the hook (exits.throws). Test: `exits.throws Demo refuses settings that did not come from useSettings`.
- The schema is referentially stable: a module constant. The hook memoises on it, so a new object each render would validate again and reset nothing but waste work; it is the demo author's contract, stated in the doc (tier ④).
- Escape closes the sidebar and returns focus to the toggle through a ref on the toggle; no document listener exists (callbacks.4, effects: none). Test: `callbacks.4 Escape in the sidebar closes it and returns focus to the toggle`.
- The ungrouped entries render first, then groups in order of first appearance in the schema (markup.5, my call). Test: `markup.5 one fieldset per group in order of first appearance`.

## defaults

- `label`: `'Settings'`, the toggle's and the sidebar's accessible name (props.9, my call).
- A vector's component names: `x`, `y`, `z`, then the index as a string (markup.11, my call).
- The toggle sits inside the stage at its top-right corner, so it stays over the demo whether the sidebar is shown or not (markup.3, my call).
- The hidden sidebar carries the `hidden` attribute: out of layout and out of the accessibility tree, and the stage expands by the flex layout alone; no transition (states.default).
- `theme` lands as `data-theme` only when given (props.8).

## notes

- The inline styles are the layout mechanics only (flex row, the stage's growth, the sidebar's scroll, the toggle's corner); Izzy's answer was unstyled markup with stable class names and the site's CSS, and the layout is what makes shrink-and-expand true without the site. A class or style prop lands after the internals.
- `useSettings.key` serialises the values of every `live: false` entry; a demo keys its scene with it so a structural change remounts and a live one does not. Where live and remount values meet in a scene is the demo's own concern.
- The number control is a range with an `output` beside it. A typed number field is a schema kind that does not exist yet; the first demo that needs one adds it, with the skill.

## gaps

- Not tested in a browser: the wrapper has no tunnel and no Canvas of its own, so its browser test comes with the first demo, where the stage, the sidebar and a scene mapping the stage's rect are exercised together.
- The responsive layout (the sidebar below the stage on a narrow viewport) is deferred to the site's CSS and to the one round with Izzy the skill names; the wrapper has one layout.
