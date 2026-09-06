# HazePlanes — resolved

Built against `HazePlanes.spec.md` plus the entries below. Test names carry the spec ids.

## contracts

contracts.1: children carry no element ids; under transform mode they are duplicated once per plane and a duplicated id resolves to the first copy — owner caller — tier ④ — no check is made
contracts.2: colours are hex; hazeResolve throws on anything else — owner caller — tier ② (exits.throws)
contracts.3: an error boundary owns exits.throws — owner ancestor — tier ④
contracts.4: `ResizeObserver` and `matchMedia` exist; without the first the component never measures and shows no planes, without the second reduced motion is not honoured — owner environment — tier ④

## defaults

defaults.1: state.reset is an adjustment during render, the React pattern for state that follows a prop, rather than an effect, so the closed frame never paints
defaults.2: the first focus scan and the reduced-motion read are deferred one microtask, the same path a mutation or a media change takes; the effect bodies set no state, as the React Compiler lint requires
defaults.3: `open` is only meaningful while fan is set; `isOpen = !fan || open`, so turning fan off shows the planes at once
defaults.4: under 'xy' and 'z' the axis that does not animate is at its open value in the closed state too, which is what lets the open transition move one quantity; a closed 'xy' fan therefore has the copies at final size behind the face, and a closed 'z' fan has them at final displacement at size 1, visible beside the face
defaults.5: `paint` is read under transform mode only; under shadow mode it is ignored without a warning
defaults.6: lengths in transforms and shadows are rounded to 3 decimals, scales to 6, matching the util's CSS output
defaults.7: `radius` on the component is the scene's radius; the border radius is `cornerRadius`. The old `radius` prop name is not aliased; it would silently become a scene value

## notes

notes.1: `paint="both"` on a copy of a `CocoonIcon` gives the icon the ink tone and its box the surface tone; the icon's own wrapper has no background, so the box shows behind the artwork
notes.2: the dev warnings fire from a layout effect keyed on the scene's error and hidden count, once per change, not per render
notes.3: jsdom keeps box-shadow text as written, `0` for the blur and hex colours; the tests match that shape

## gaps

gaps.1: defaults.4 makes a closed `'z'` fan visible; if the intent was a fully hidden rest state for every fan, `'z'` needs the displacement to animate as well, which is `'both'`. Left as specified, flagged for Izzy
