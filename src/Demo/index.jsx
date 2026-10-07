import { useId, useRef, useState } from 'react'

// The wrapper every <Name>.demo.jsx renders into: the stage that holds the
// demo's markup (its tunnel.In with the fiber root, rendering nothing in the
// DOM) and the settings sidebar rendered from the demo's schema. Built from
// Demo.spec.md; Demo.resolved.md records what the build settled. The inline
// styles are the layout only (flex, scroll, the toggle's corner); paint is the
// site's, through the class names and `data-theme`.

/**
 * @typedef {object} DemoProps
 * @property {ReturnType<typeof import('./useSettings.js').useSettings>} settings what useSettings returned
 * @property {boolean} [openSettings] controls the sidebar when given; otherwise the toggle owns it
 * @property {(open: boolean) => void} [onOpenSettingsChange] the next state, whenever the toggle or Escape asks
 * @property {string} [demoContainerClass] appended to the root's classes
 * @property {object} [demoContainerStyle] merged last onto the root's style
 * @property {string} [settingContainerClass] appended to the sidebar's classes
 * @property {object} [settingContainerStyle] merged last onto the sidebar's style
 * @property {string} [theme] lands as data-theme on the root
 * @property {string} [label='Settings'] the toggle's and the sidebar's accessible name
 * @property {import('react').Ref<HTMLDivElement>} [ref] the root div
 * @property {import('react').ReactNode} [children] the demo's markup
 */

const rootStyle = {
  position: 'relative',
  display: 'flex',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  boxSizing: 'border-box',
  border: 0,
  margin: 0,
  padding: 0,
}
const stageStyle = {
  position: 'relative',
  flex: '1 1 auto',
  minWidth: 0,
  height: '100%',
}
const toggleStyle = { position: 'absolute', top: 0, right: 0 }
const sidebarStyle = {
  // bounded, so a sidebar wider than its content's share never collapses the stage: the site widens it through settingContainerStyle
  flex: '0 1 auto',
  maxWidth: '50%',
  minWidth: 0,
  height: '100%',
  overflow: 'auto',
  boxSizing: 'border-box',
}

const cx = (...names) => names.filter(Boolean).join(' ')

/** @param {DemoProps & Record<string, *>} props */
export function Demo({
  settings,
  openSettings,
  onOpenSettingsChange,
  demoContainerClass,
  demoContainerStyle,
  settingContainerClass,
  settingContainerStyle,
  theme,
  label = 'Settings',
  ref,
  children,
  className,
  style,
  ...rest
}) {
  if (
    !settings ||
    typeof settings.set !== 'function' ||
    typeof settings.reset !== 'function' ||
    !settings.schema ||
    !settings.values
  ) {
    throw new Error(
      'Demo: `settings` must be what useSettings(schema) returns; call useSettings in the demo and pass its result',
    )
  }
  const controlled = openSettings !== undefined
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlled ? openSettings : ownOpen
  const id = useId()
  const sidebarId = `${id}-settings`
  const toggleRef = useRef(null)

  const requestOpen = (next) => {
    onOpenSettingsChange?.(next)
    if (!controlled) setOwnOpen(next)
  }
  const handleToggle = () => requestOpen(!open)
  const handleKeyDown = (event) => {
    if (event.key !== 'Escape') return
    requestOpen(false)
    toggleRef.current?.focus()
  }

  const { schema, values } = settings
  const groups = groupEntries(schema, values)

  return (
    <div
      {...rest}
      ref={ref}
      className={cx('cocoon-demo', className, demoContainerClass)}
      data-theme={theme}
      style={{ ...rootStyle, ...style, ...demoContainerStyle }}
    >
      <div className='cocoon-demo__stage' style={stageStyle}>
        {children}
        <button
          type='button'
          ref={toggleRef}
          className='cocoon-demo__toggle'
          aria-expanded={open}
          aria-controls={sidebarId}
          style={toggleStyle}
          onClick={handleToggle}
        >
          {label}
        </button>
      </div>
      <aside
        id={sidebarId}
        className={cx('cocoon-demo__settings', settingContainerClass)}
        aria-label={label}
        hidden={!open}
        style={{ ...sidebarStyle, ...settingContainerStyle }}
        onKeyDown={handleKeyDown}
      >
        {groups.map(({ name, entries }) => (
          <fieldset key={name ?? ''} className='cocoon-demo__group'>
            {name !== undefined && <legend>{name}</legend>}
            {entries.map(([key, entry]) => (
              <Field
                key={key}
                id={`${id}-${key}`}
                name={key}
                entry={entry}
                value={values[key]}
                set={settings.set}
              />
            ))}
          </fieldset>
        ))}
        <button
          type='button'
          className='cocoon-demo__reset'
          onClick={settings.reset}
        >
          Reset
        </button>
      </aside>
    </div>
  )
}

/** The schema's entries whose `when` holds, in schema order, grouped by `group` in order of first appearance; the ungrouped first. */
function groupEntries(schema, values) {
  const groups = new Map([[undefined, []]])
  for (const [key, entry] of Object.entries(schema)) {
    if (entry.when && values[entry.when.key] !== entry.when.value) continue
    if (!groups.has(entry.group)) groups.set(entry.group, [])
    groups.get(entry.group).push([key, entry])
  }
  return [...groups]
    .filter(([, entries]) => entries.length > 0)
    .map(([name, entries]) => ({ name, entries }))
}

/** One control, by kind (markup.6–11). */
function Field({ id, name, entry, value, set }) {
  const label = entry.label ?? name
  const field = (control) => (
    <div className='cocoon-demo__field' data-kind={entry.kind}>
      <label htmlFor={id}>{label}</label>
      {control}
    </div>
  )
  switch (entry.kind) {
    case 'number':
      return field(
        <>
          <input
            type='range'
            id={id}
            min={entry.min}
            max={entry.max}
            step={entry.step}
            value={value}
            onChange={(e) => set(name, Number(e.target.value))}
          />
          <output htmlFor={id}>{value}</output>
        </>,
      )
    case 'boolean':
      return field(
        <input
          type='checkbox'
          id={id}
          checked={value}
          onChange={(e) => set(name, e.target.checked)}
        />,
      )
    case 'select':
      return field(
        <select
          id={id}
          value={value}
          onChange={(e) => set(name, e.target.value)}
        >
          {entry.options.map((option) => {
            const { value: v, label: l } =
              typeof option === 'string'
                ? { value: option, label: option }
                : option
            return (
              <option key={v} value={v}>
                {l}
              </option>
            )
          })}
        </select>,
      )
    case 'colour':
      return field(
        <input
          type='color'
          id={id}
          value={value}
          onChange={(e) => set(name, e.target.value)}
        />,
      )
    case 'vector': {
      const names = entry.components ?? ['x', 'y', 'z']
      return (
        <fieldset className='cocoon-demo__vector' data-kind='vector'>
          <legend>{label}</legend>
          {value.map((component, i) => {
            const cid = `${id}-${i}`
            return (
              <div className='cocoon-demo__field' data-kind='vector' key={cid}>
                <label htmlFor={cid}>{names[i] ?? String(i)}</label>
                <input
                  type='number'
                  id={cid}
                  step={entry.step}
                  value={component}
                  onChange={(e) => {
                    const next = [...value]
                    next[i] = Number(e.target.value)
                    set(name, next)
                  }}
                />
              </div>
            )
          })}
        </fieldset>
      )
    }
    default:
      return null
  }
}
