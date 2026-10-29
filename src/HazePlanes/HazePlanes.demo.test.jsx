// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import * as module from './HazePlanes.demo.jsx'
import { HazePlanesDemo } from './HazePlanes.demo.jsx'

// The demo under test the way the manifest reads it (the four fixed exports)
// and the way the site mounts it (the wrapper's stage with the sidebar open):
// the settings reach the component, the content setting swaps what the haze
// wraps, the conditional controls follow their conditions. The copies and the
// shadow's layers need a measured box, which jsdom has not; the fit test
// (src/manifest.browser.test.js) mounts the demo in a real page.

afterEach(cleanup)

/** The component's wrapper span, the stage's first child. */
const wrapper = (container) =>
  container.querySelector('.cocoon-demo__haze > span')

describe('HazePlanes demo', () => {
  it('the four fixed exports: demo, schema, scene false, effects none', () => {
    expect(module.demo).toBe(HazePlanesDemo)
    expect(module.scene).toBe(false)
    expect(module.effects).toEqual([])
    expect(Object.isFrozen(module.effects)).toBe(true)
    expect(Object.isFrozen(module.schema)).toBe(true)
    for (const [key, entry] of Object.entries(module.schema)) {
      expect(['number', 'boolean', 'select', 'colour'], key).toContain(
        entry.kind,
      )
      expect(entry.group, key).toBeTruthy()
    }
  })

  it('mounts in the wrapper with the sidebar open: one control per visible setting, the mark inside the haze', () => {
    const { container } = render(<HazePlanesDemo openSettings />)
    const sidebar = screen.getByRole('complementary', { name: 'Settings' })
    const labels = [...sidebar.querySelectorAll('label')].map(
      (l) => l.textContent,
    )
    expect(labels).toContain('content')
    expect(labels).toContain('planes')
    expect(labels).toContain('fan')
    expect(labels).not.toContain('corner radius (px)') // hidden while the corner is auto
    const svg = container.querySelector('.cocoon-demo__haze svg')
    expect(svg).not.toBeNull()
    expect(wrapper(container).contains(svg)).toBe(true)
  })

  it("a change in the sidebar reaches the component and the stage: a corner radius lands on the wrapper, the surface on the stage's text colour", () => {
    const { container } = render(<HazePlanesDemo openSettings />)
    fireEvent.click(screen.getByLabelText('corner radius: auto'))
    fireEvent.input(screen.getByLabelText('corner radius (px)'), {
      target: { value: '12' },
    })
    expect(wrapper(container).style.borderRadius).toBe('12px')
    const stage = container.querySelector('.cocoon-demo__haze')
    expect(stage.style.color).toBe('rgb(20, 20, 20)') // the default surface, #141414
    fireEvent.input(screen.getByLabelText('surface'), {
      target: { value: '#ff0000' },
    })
    expect(stage.style.color).toBe('rgb(255, 0, 0)')
  })

  it('the content setting swaps what the haze wraps: the mark, a word, a button; the icon setting shows only for the mark', () => {
    const { container } = render(<HazePlanesDemo openSettings />)
    const content = screen.getByLabelText('content')
    expect(screen.queryByLabelText('icon')).not.toBeNull()
    fireEvent.change(content, { target: { value: 'word' } })
    expect(container.querySelector('.cocoon-demo__haze svg')).toBeNull()
    expect(screen.getByText('Cocoon')).toBeTruthy()
    expect(screen.queryByLabelText('icon')).toBeNull()
    fireEvent.change(content, { target: { value: 'button' } })
    expect(screen.getByRole('button', { name: 'Press' })).toBeTruthy()
  })

  it('the corner radius input appears when auto is off, and the paint select only in transform mode', () => {
    render(<HazePlanesDemo openSettings />)
    fireEvent.click(screen.getByLabelText('corner radius: auto'))
    expect(screen.getByLabelText('corner radius (px)')).toBeTruthy()
    expect(screen.getByLabelText('paint')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('mode'), {
      target: { value: 'shadow' },
    })
    expect(screen.queryByLabelText('paint')).toBeNull()
  })

  it('the stage takes the ground colour as its background, so the planes read against it', () => {
    const { container } = render(<HazePlanesDemo openSettings />)
    const stage = container.querySelector('.cocoon-demo__haze')
    expect(stage.style.background).not.toBe('')
    fireEvent.input(screen.getByLabelText('ground'), {
      target: { value: '#000000' },
    })
    expect(stage.style.background).toBe('rgb(0, 0, 0)')
  })

  it('server render: no browser global is touched before an effect', () => {
    expect(() => renderToString(<HazePlanesDemo />)).not.toThrow()
  })
})
