# Demo

`src/Demo/index.jsx` and `src/Demo/useSettings.js`. The wrapper every component's demo renders into on the site: a stage that holds the demo's markup, and a settings sidebar rendered from a schema. Built from `Demo.spec.md`; `Demo.resolved.md` records what the build settled. The demo skill (`.claude/skills/demo/SKILL.md`) says what a `<Name>.demo.jsx` is; this doc is the wrapper's API.

```jsx
import { Demo, useSettings } from 'cocoon-ai'
import tunnel from 'tunnel-rat'

const schema = {
  forceValue: {
    kind: 'number',
    default: 1,
    min: 0,
    max: 10,
    step: 0.1,
    group: 'fluid',
  },
  material: {
    kind: 'select',
    default: 'basic',
    options: ['basic', 'standard'],
    live: false,
    group: 'material',
  },
  color: {
    kind: 'colour',
    default: '#ffffff',
    when: { key: 'material', value: 'standard' },
    group: 'material',
  },
}

export function FluidDemo({ tunnel, ...props }) {
  const settings = useSettings(schema)
  return (
    <Demo settings={settings} {...props}>
      <tunnel.In>
        <group key={settings.key}>
          {/* the scene, reading settings.values */}
        </group>
      </tunnel.In>
    </Demo>
  )
}
```

The site renders `<tunnel.Out />` into a full-viewport View in its one Canvas; the demo never renders a Canvas, and nothing is wrapped around what it sends through the tunnel.

## Props

| prop                    | default      |                                                                                                     |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `settings`              | required     | what `useSettings(schema)` returned                                                                 |
| `openSettings`          |              | when given, controls whether the sidebar is shown; otherwise the toggle button owns it              |
| `onOpenSettingsChange`  |              | `(open) => void`, the next state whenever the toggle or Escape asks for a change, controlled or not |
| `demoContainerClass`    |              | appended to the root's classes, after `className`                                                   |
| `demoContainerStyle`    |              | merged last onto the root's inline style, after `style`                                             |
| `settingContainerClass` |              | appended to the sidebar's classes                                                                   |
| `settingContainerStyle` |              | merged last onto the sidebar's inline style                                                         |
| `theme`                 |              | lands as `data-theme` on the root; absent when not given                                            |
| `label`                 | `'Settings'` | the toggle's accessible name and the sidebar's                                                      |
| `ref`                   |              | the root div                                                                                        |
| `children`              |              | the demo's markup, inside the stage                                                                 |

Other props are spread onto the root div.

## The markup

```
div.cocoon-demo[data-theme]            flex row, fills its container, overflow hidden
  div.cocoon-demo__stage               flex 1, the demo's children, then
    button.cocoon-demo__toggle         aria-expanded, aria-controls the sidebar; top-right of the stage
  aside.cocoon-demo__settings          hidden when closed; at most half the container, scrolling both ways; one fieldset per group
    fieldset.cocoon-demo__group        legend = the group; the ungrouped entries first, with no legend
      div.cocoon-demo__field[data-kind]  label + input (range with an output, checkbox, select, color)
      fieldset.cocoon-demo__vector     legend = the label; one number input per component
    button.cocoon-demo__reset          last
```

The inline styles are the layout only: the flex row, the stage's growth, the sidebar's bound of half the container and its scroll, the toggle's corner. Paint is the site's, through the class names and `data-theme`; a class or style prop lands after the internals, so the site's rules win. The stage shrinks when the sidebar is shown and expands when it is hidden; a scene that sizes itself from its container's rect follows.

Keyboard: the toggle is a button; the sidebar follows it in tab order; Escape inside the sidebar closes it and returns focus to the toggle. When `openSettings` is given, the toggle and Escape only call `onOpenSettingsChange`.

## The schema and `useSettings`

A plain object keyed by setting. Each entry:

| field        | kinds          |                                                                                       |
| ------------ | -------------- | ------------------------------------------------------------------------------------- |
| `kind`       | all            | `number`, `boolean`, `select`, `colour`, `vector`                                     |
| `default`    | all            | the initial value; read from `cocoon.config.js` where one exists                      |
| `label`      | all            | shown beside the control; the key when absent                                         |
| `min`, `max` | number         | the range's bounds                                                                    |
| `step`       | number, vector |                                                                                       |
| `options`    | select         | strings, or `{ value, label }`                                                        |
| `components` | vector         | the component names, default `x`, `y`, `z`; the default array's length sets the count |
| `live`       | all            | `false` when a change must remount the scene; the hook's `key` changes with it        |
| `when`       | all            | `{ key, value }`: rendered only while `values[key] === value`                         |
| `group`      | all            | the fieldset the control sits in; groups appear in order of first appearance          |

`useSettings(schema)` validates the schema once and throws, naming the key, on an entry it cannot render: no kind or an unknown one, a select without options, a number without a numeric default, a vector whose default is not an array. It returns `{ schema, values, set(key, value), reset(), key }`. `values` holds the current value per key; `set` and `reset` are stable; `key` is a string that changes only when an entry with `live: false` changes, so a scene keyed by it remounts for those and updates in place for the rest. The schema must be referentially stable, a module constant, or it is validated on every render.

`Demo` throws from render when `settings` is not what `useSettings` returned, naming the hook.

## Limits

- Every control is one of the five kinds. A control the schema cannot describe is hand-written in the demo, outside the sidebar, and named in the demo's resolved file as the exception.
- The sidebar is rendered open or hidden with no transition; a transition is the site's CSS on `.cocoon-demo__settings`, if wanted.
- Responsive layout below a width where the sidebar cannot sit beside the stage is the site's, by a style on the sidebar; the wrapper does not switch layouts on its own.
