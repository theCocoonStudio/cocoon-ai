// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { readFileSync } from 'node:fs'
import { ICONS_MODULE, iconsModule } from '../../assets/icons/build.js'
import { CocoonIcon, iconNames, icons } from './index.jsx'

afterEach(cleanup)

const wrapper = (c) => c.container.firstChild

describe('CocoonIcon markup', () => {
  it('markup.1 root span: inline-flex, 1em box, optical vertical-align, flex none', () => {
    const el = wrapper(render(<CocoonIcon name='menu' />))
    expect(el.tagName).toBe('SPAN')
    expect(el.style.display).toBe('inline-flex')
    expect(el.style.width).toBe('1em')
    expect(el.style.height).toBe('1em')
    expect(el.style.verticalAlign).toBe('-0.125em')
    expect(el.style.flexGrow).toBe('0')
    expect(el.style.color).toBe('')
  })

  it('props.2 size: a number is px, a string is any CSS length', () => {
    expect(
      wrapper(render(<CocoonIcon name='menu' size={24} />)).style.width,
    ).toBe('24px')
    expect(
      wrapper(render(<CocoonIcon name='menu' size='1.5em' />)).style.width,
    ).toBe('1.5em')
    expect(
      wrapper(render(<CocoonIcon name='menu' size='var(--s)' />)).style.height,
    ).toBe('var(--s)')
  })

  it('props.3 color sets the text colour; props.5 style merges last', () => {
    const el = wrapper(
      render(
        <CocoonIcon name='menu' color='#0000AA' style={{ verticalAlign: 0 }} />,
      ),
    )
    expect(el.style.color).toBe('rgb(0, 0, 170)')
    expect(el.style.verticalAlign).toBe('0px')
  })

  it('markup.2 the named icon fills the box, every fill currentColor', () => {
    const el = wrapper(render(<CocoonIcon name='settings' />))
    const svg = el.querySelector('svg')
    expect(svg.getAttribute('viewBox')).toMatch(/^0\.000 0\.000 /)
    expect(svg.style.width).toBe('100%')
    expect(svg.style.height).toBe('100%')
    expect(svg.style.display).toBe('block')
    const paths = [...svg.querySelectorAll('path')]
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) expect(p.getAttribute('fill')).toBe('currentColor')
  })

  it('markup.3 an svg child is cloned to fill the box, its own style kept', () => {
    const el = wrapper(
      render(
        <CocoonIcon>
          <svg viewBox='0 0 10 10' style={{ opacity: 0.5 }} data-own='yes' />
        </CocoonIcon>,
      ),
    )
    const svg = el.querySelector('svg')
    expect(svg.getAttribute('data-own')).toBe('yes')
    expect(svg.style.width).toBe('100%')
    expect(svg.style.opacity).toBe('0.5')
  })

  it('markup.4 decorative without a title, role img with one', () => {
    expect(
      wrapper(render(<CocoonIcon name='menu' />)).getAttribute('aria-hidden'),
    ).toBe('true')
    render(<CocoonIcon name='menu' title='Open menu' />)
    const img = screen.getByRole('img', { name: 'Open menu' })
    expect(img.getAttribute('aria-hidden')).toBeNull()
  })

  it('props.passthrough and props.ref land on the root span', () => {
    const ref = createRef()
    const el = wrapper(
      render(<CocoonIcon name='menu' ref={ref} className='x' data-t='1' />),
    )
    expect(ref.current).toBe(el)
    expect(el.className).toBe('x')
    expect(el.getAttribute('data-t')).toBe('1')
  })
})

describe('CocoonIcon exits', () => {
  it('exits.throws an unknown name, listing the names that exist', () => {
    expect(() => CocoonIcon({ name: 'nope' })).toThrow(
      /no icon named "nope".*menu/,
    )
  })

  it('exits.throws inherited names too: constructor, toString, valueOf, __proto__', () => {
    for (const bad of ['constructor', 'toString', 'valueOf', '__proto__'])
      expect(() => CocoonIcon({ name: bad })).toThrow(/no icon named/)
  })

  it('exits.throws with neither a name nor a child', () => {
    expect(() => CocoonIcon({})).toThrow(/either a `name` or an <svg> child/)
  })
})

describe('CocoonIcon library', () => {
  it('library.utils the generated icon module matches a fresh render of the set', () => {
    const committed = readFileSync(ICONS_MODULE, 'utf8')
    expect(committed).toBe(iconsModule())
  })

  it('library.export iconNames are the 13 square files, each an svg component', () => {
    expect(iconNames).toHaveLength(13)
    for (const n of iconNames) expect(typeof icons[n]).toBe('function')
    expect(iconNames).toContain('launch')
  })
})
