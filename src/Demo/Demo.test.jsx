// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { Component, createRef, useEffect } from 'react'
import { Demo } from './index.jsx'
import { useSettings } from './useSettings.js'

// The wrapper under RTL: the stage, the toggle, the sidebar rendered from a
// schema, and the hook that holds the values. Test names carry the spec ids.

const schema = {
  speed: {
    kind: 'number',
    default: 1,
    min: 0,
    max: 10,
    step: 0.5,
    group: 'motion',
  },
  on: { kind: 'boolean', default: true },
  material: {
    kind: 'select',
    default: 'basic',
    options: ['basic', { value: 'standard', label: 'Standard' }],
    live: false,
    group: 'material',
  },
  colour: {
    kind: 'colour',
    default: '#ff0000',
    when: { key: 'material', value: 'standard' },
    group: 'material',
  },
  position: {
    kind: 'vector',
    default: [0, 1, 2],
    step: 0.1,
    components: ['x', 'y', 'z'],
    group: 'motion',
  },
}

let latest = null
function Harness({ schema: s = schema, children, ...props }) {
  const settings = useSettings(s)
  useEffect(() => {
    latest = settings
  })
  return (
    <Demo settings={settings} {...props}>
      {children}
    </Demo>
  )
}

class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    return this.state.error ? (
      <p role='alert'>{this.state.error.message}</p>
    ) : (
      this.props.children
    )
  }
}

const sidebar = () => screen.getByRole('complementary', { hidden: true })
const toggle = () => screen.getByRole('button', { name: 'Settings' })

afterEach(() => {
  cleanup()
  latest = null
})

describe('Demo markup', () => {
  it('markup.1 the root is a div with the class, the theme attribute only when given, and the class and style props appended last', () => {
    const { container, rerender } = render(<Harness />)
    const root = container.firstElementChild
    expect(root.tagName).toBe('DIV')
    expect(root.className).toBe('cocoon-demo')
    expect(root.hasAttribute('data-theme')).toBe(false)
    expect(root.style.display).toBe('flex')
    rerender(
      <Harness
        theme='dark'
        className='site'
        demoContainerClass='site-demo'
        style={{ background: 'red' }}
        demoContainerStyle={{ background: 'blue', width: '50%' }}
      />,
    )
    expect(root.getAttribute('data-theme')).toBe('dark')
    expect(root.className).toBe('cocoon-demo site site-demo')
    expect(root.style.background).toBe('blue')
    expect(root.style.width).toBe('50%')
    expect(root.style.display).toBe('flex')
  })

  it('props.ref and props.passthrough land on the root', () => {
    const ref = createRef()
    const { container } = render(<Harness ref={ref} data-x='1' />)
    expect(ref.current).toBe(container.firstElementChild)
    expect(ref.current.getAttribute('data-x')).toBe('1')
  })

  it('markup.2 children render inside the stage, before the toggle', () => {
    const { container } = render(
      <Harness>
        <span data-testid='scene' />
      </Harness>,
    )
    const stage = container.querySelector('.cocoon-demo__stage')
    expect(stage.firstElementChild.dataset.testid).toBe('scene')
    expect(stage.lastElementChild).toBe(toggle())
  })

  it('markup.3 the toggle is a button named by props.9, expanded false at rest, controlling the sidebar; markup.4 the sidebar is an aside with that name', () => {
    render(<Harness label='Knobs' />)
    const button = screen.getByRole('button', { name: 'Knobs' })
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const aside = screen.getByRole('complementary', { hidden: true })
    expect(aside.tagName).toBe('ASIDE')
    expect(aside.id).toBe(button.getAttribute('aria-controls'))
    expect(aside.getAttribute('aria-label')).toBe('Knobs')
    expect(aside.className).toBe('cocoon-demo__settings')
  })

  it('markup.4 the sidebar takes its class and style props', () => {
    render(
      <Harness
        openSettings
        settingContainerClass='site-settings'
        settingContainerStyle={{ width: 320, overflowY: 'scroll' }}
      />,
    )
    const aside = sidebar()
    expect(aside.className).toBe('cocoon-demo__settings site-settings')
    expect(aside.style.width).toBe('320px')
    expect(aside.style.overflowY).toBe('scroll')
  })

  it('markup.5 one fieldset per group in order of first appearance, the ungrouped first with no legend', () => {
    render(<Harness openSettings />)
    const groups = within(sidebar()).getAllByRole('group')
    const top = groups.filter((g) => g.className === 'cocoon-demo__group')
    expect(
      top.map((g) => g.querySelector('legend')?.textContent ?? null),
    ).toEqual([null, 'motion', 'material'])
    expect(within(top[0]).getByLabelText('on')).toBeTruthy()
    expect(within(top[1]).getByLabelText('speed')).toBeTruthy()
    expect(within(top[2]).getByLabelText('material')).toBeTruthy()
  })

  it('markup.7–10 each kind renders its input, labelled by the key or the label', () => {
    render(<Harness openSettings />)
    const speed = screen.getByLabelText('speed')
    expect(speed.type).toBe('range')
    expect([speed.min, speed.max, speed.step]).toEqual(['0', '10', '0.5'])
    expect(speed.value).toBe('1')
    expect(speed.parentElement.querySelector('output').textContent).toBe('1')
    expect(speed.parentElement.dataset.kind).toBe('number')
    const on = screen.getByLabelText('on')
    expect(on.type).toBe('checkbox')
    expect(on.checked).toBe(true)
    const material = screen.getByLabelText('material')
    expect(material.tagName).toBe('SELECT')
    expect([...material.options].map((o) => [o.value, o.textContent])).toEqual([
      ['basic', 'basic'],
      ['standard', 'Standard'],
    ])
  })

  it('markup.11 a vector is a fieldset with one number input per component, named by components', () => {
    render(<Harness openSettings />)
    const vector = screen.getByRole('group', { name: 'position' })
    expect(vector.className).toBe('cocoon-demo__vector')
    const inputs = ['x', 'y', 'z'].map((n) => within(vector).getByLabelText(n))
    expect(inputs.map((i) => i.type)).toEqual(['number', 'number', 'number'])
    expect(inputs.map((i) => i.value)).toEqual(['0', '1', '2'])
    expect(inputs[0].step).toBe('0.1')
  })

  it('markup.12 an entry with `when` is absent until the condition holds, and gone again when it stops', () => {
    render(<Harness openSettings />)
    expect(screen.queryByLabelText('colour')).toBeNull()
    fireEvent.change(screen.getByLabelText('material'), {
      target: { value: 'standard' },
    })
    expect(screen.getByLabelText('colour').type).toBe('color')
    fireEvent.change(screen.getByLabelText('material'), {
      target: { value: 'basic' },
    })
    expect(screen.queryByLabelText('colour')).toBeNull()
  })

  it('markup.13 the reset button is last in the sidebar; states.empty an empty schema renders it alone', () => {
    render(<Harness openSettings schema={{}} />)
    const aside = sidebar()
    expect(aside.children).toHaveLength(1)
    const reset = within(aside).getByRole('button', { name: 'Reset' })
    expect(reset).toBe(aside.lastElementChild)
    expect(reset.getAttribute('type')).toBe('button')
  })
})

describe('Demo states and callbacks', () => {
  it('states.default the sidebar is hidden; callbacks.1 the toggle opens and closes it and reports each change', () => {
    const onChange = vi.fn()
    render(<Harness onOpenSettingsChange={onChange} />)
    expect(sidebar().hidden).toBe(true)
    expect(screen.queryByRole('complementary')).toBeNull()
    fireEvent.click(toggle())
    expect(sidebar().hidden).toBe(false)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(onChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(toggle())
    expect(sidebar().hidden).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith(false)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('callbacks.neg.1 with openSettings given the toggle changes nothing itself; the prop does', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Harness openSettings={false} onOpenSettingsChange={onChange} />,
    )
    fireEvent.click(toggle())
    expect(sidebar().hidden).toBe(true)
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<Harness openSettings onOpenSettingsChange={onChange} />)
    expect(sidebar().hidden).toBe(false)
  })

  it('callbacks.2 a change on each kind reaches set with the typed value', () => {
    render(<Harness openSettings />)
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '3' } })
    expect(latest.values.speed).toBe(3)
    fireEvent.click(screen.getByLabelText('on'))
    expect(latest.values.on).toBe(false)
    fireEvent.change(screen.getByLabelText('material'), {
      target: { value: 'standard' },
    })
    expect(latest.values.material).toBe('standard')
    fireEvent.change(screen.getByLabelText('colour'), {
      target: { value: '#00ff00' },
    })
    expect(latest.values.colour).toBe('#00ff00')
    const vector = screen.getByRole('group', { name: 'position' })
    fireEvent.change(within(vector).getByLabelText('y'), {
      target: { value: '5' },
    })
    expect(latest.values.position).toEqual([0, 5, 2])
    expect(
      screen.getByLabelText('speed').parentElement.querySelector('output')
        .textContent,
    ).toBe('3')
  })

  it('context.hook.1 the key changes only when an entry with live false changes', () => {
    render(<Harness openSettings />)
    const k0 = latest.key
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '3' } })
    expect(latest.key).toBe(k0)
    fireEvent.change(screen.getByLabelText('material'), {
      target: { value: 'standard' },
    })
    expect(latest.key).not.toBe(k0)
  })

  it('callbacks.3 reset returns every value to its default', () => {
    render(<Harness openSettings />)
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('material'), {
      target: { value: 'standard' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(latest.values).toEqual({
      speed: 1,
      on: true,
      material: 'basic',
      colour: '#ff0000',
      position: [0, 1, 2],
    })
    expect(screen.queryByLabelText('colour')).toBeNull()
  })

  it('callbacks.4 Escape in the sidebar closes it and returns focus to the toggle; controlled, only the callback fires', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Harness onOpenSettingsChange={onChange} />)
    fireEvent.click(toggle())
    const speed = screen.getByLabelText('speed')
    speed.focus()
    fireEvent.keyDown(speed, { key: 'Escape' })
    expect(sidebar().hidden).toBe(true)
    expect(document.activeElement).toBe(toggle())
    expect(onChange).toHaveBeenLastCalledWith(false)
    rerender(<Harness openSettings onOpenSettingsChange={onChange} />)
    fireEvent.keyDown(screen.getByLabelText('speed'), { key: 'Escape' })
    expect(sidebar().hidden).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('callbacks.neg: a key other than Escape in the sidebar changes nothing', () => {
    render(<Harness />)
    fireEvent.click(toggle())
    fireEvent.keyDown(screen.getByLabelText('speed'), { key: 'Enter' })
    expect(sidebar().hidden).toBe(false)
  })

  it('two instances: each has its own values and open state', () => {
    render(
      <>
        <Harness label='A' />
        <Harness label='B' />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'A' }))
    const [a, b] = screen.getAllByRole('complementary', { hidden: true })
    expect(a.hidden).toBe(false)
    expect(b.hidden).toBe(true)
    fireEvent.change(within(a).getByLabelText('speed'), {
      target: { value: '7' },
    })
    expect(within(a).getByLabelText('speed').value).toBe('7')
    expect(within(b).getByLabelText('speed').value).toBe('1')
  })
})

describe('Demo exits', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

  it.each([
    [{ x: { default: 1 } }, /"x" has no kind/],
    [
      { x: { kind: 'select', default: 'a' } },
      /"x" is a select with no options/,
    ],
    [{ x: { kind: 'number' } }, /"x" is a number with no numeric default/],
    [{ x: { kind: 'vector', default: 1 } }, /"x" is a vector/],
  ])(
    'exits.throws useSettings refuses a bad schema, naming the key',
    (bad, message) => {
      const spy = quiet()
      render(
        <Boundary>
          <Harness schema={bad} />
        </Boundary>,
      )
      expect(screen.getByRole('alert').textContent).toMatch(message)
      spy.mockRestore()
    },
  )

  it('exits.throws Demo refuses settings that did not come from useSettings, naming the hook', () => {
    const spy = quiet()
    render(
      <Boundary>
        <Demo settings={{ values: {} }} />
      </Boundary>,
    )
    expect(screen.getByRole('alert').textContent).toMatch(/useSettings/)
    spy.mockRestore()
  })
})
