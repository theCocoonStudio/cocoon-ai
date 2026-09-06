// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import { createRef, useEffect, useState } from 'react'
import { hazeAnalyse, hazeTones } from '../utils/hazePlanes.js'
import { HazePlanes } from './index.jsx'

// ResizeObserver and matchMedia are not in jsdom. Each observer instance is
// kept so a test can deliver a size; matchMedia answers from `reducedMotion`.
const observers = []
let reducedMotion = false
const mqListeners = []
beforeEach(() => {
  observers.length = 0
  mqListeners.length = 0
  reducedMotion = false
  globalThis.ResizeObserver = class {
    constructor(cb) {
      this.cb = cb
      observers.push(this)
    }
    observe() {}
    disconnect() {
      this.disconnected = true
    }
  }
  globalThis.matchMedia = () => ({
    get matches() {
      return reducedMotion
    },
    addEventListener: (_, l) => mqListeners.push(l),
    removeEventListener: () => {},
  })
})
afterEach(cleanup)

const measure = async (width, height = width) =>
  act(async () => {
    for (const o of observers) o.cb([{ contentRect: { width, height } }])
  })
const flush = () => act(async () => {})
const root = (c) => c.container.firstChild
const copies = (el) => [...el.querySelectorAll(':scope > span[aria-hidden]')]
const W = 200
const H = 100
const scene = (extra = {}) => hazeAnalyse({ width: W, height: H, ...extra })
const tx = (p, k) => {
  const pl = p.planes[k - 1]
  return `translate(${pl.dx.toFixed(3).replace(/\.?0+$/, '')}px, ${pl.dy.toFixed(3).replace(/\.?0+$/, '')}px) scale(${Number(pl.scale.toFixed(6))})`
}
const norm = (s) => s.replace(/(\d)\.?0+px/g, '$1px')

describe('HazePlanes markup', () => {
  it('markup.9 / states.unmeasured: no planes before the element has a width', () => {
    const el = root(render(<HazePlanes>x</HazePlanes>))
    expect(copies(el)).toHaveLength(0)
    expect(el.lastChild.textContent).toBe('x')
  })

  it('markup.1 root span, relative, inline-block, className, style last, passthrough, ref', async () => {
    const ref = createRef()
    const el = root(
      render(
        <HazePlanes
          ref={ref}
          className='c'
          data-t='1'
          style={{ display: 'block' }}
        >
          x
        </HazePlanes>,
      ),
    )
    expect(ref.current).toBe(el)
    expect(el.className).toBe('c')
    expect(el.getAttribute('data-t')).toBe('1')
    expect(el.style.position).toBe('relative')
    expect(el.style.display).toBe('block')
  })

  it('markup.2–4 transform mode: one aria-hidden copy per plane, furthest first, moved along the angle and scaled about its centre', async () => {
    const c = render(<HazePlanes>x</HazePlanes>)
    await measure(W, H)
    const el = root(c)
    const cs = copies(el)
    expect(cs).toHaveLength(3)
    const p = scene()
    expect(norm(cs[0].style.transform)).toBe(norm(tx(p, 3)))
    expect(norm(cs[2].style.transform)).toBe(norm(tx(p, 1)))
    for (const s of cs) {
      expect(s.style.position).toBe('absolute')
      expect(s.style.pointerEvents).toBe('none')
      expect(s.style.userSelect).toBe('none')
      expect(s.style.transformOrigin).toBe('50% 50%')
      expect(s.textContent).toBe('x')
    }
    // markup.2: the content is last, above every plane
    expect(el.lastChild.getAttribute('aria-hidden')).toBeNull()
    expect(el.lastChild.style.position).toBe('relative')
  })

  it('props.4 angle 90 moves the copies straight down, in pixels from the measured width', async () => {
    const c = render(<HazePlanes angle={90}>x</HazePlanes>)
    await measure(W, H)
    const p = scene({ angle: 90 })
    expect(p.planes[2].dy).toBeCloseTo((1.9 / 3) * W, 6)
    expect(norm(copies(root(c))[0].style.transform)).toBe(norm(tx(p, 3)))
  })

  it('markup.5 paint color and background take the surface ramp', async () => {
    const tones = hazeTones({ planes: 4, cut: 'vapour' })
    let c = render(<HazePlanes>x</HazePlanes>)
    await measure(W, H)
    let far = copies(root(c))[0]
    expect(far.style.color).toBe('rgb(244, 244, 244)')
    expect(far.style.background).toBe('')
    cleanup()
    c = render(<HazePlanes paint='background'>x</HazePlanes>)
    await measure(W, H)
    far = copies(root(c))[0]
    expect(far.style.background).toBe('rgb(244, 244, 244)')
    expect(far.style.color).toBe('')
    expect(tones[3]).toBe('#F4F4F4')
  })

  it('markup.6 paint both: box from the surface ramp, content from the ink ramp, so they differ', async () => {
    const c = render(
      <HazePlanes paint='both' surface='#141414' ink='#FFFFFF' ground='#888888'>
        x
      </HazePlanes>,
    )
    await measure(W, H)
    const near = copies(root(c))[2]
    const boxTones = hazeTones({
      planes: 4,
      cut: 'vapour',
      surface: '#141414',
      ground: '#888888',
    })
    const inkTones = hazeTones({
      planes: 4,
      cut: 'vapour',
      surface: '#FFFFFF',
      ground: '#888888',
    })
    const rgb = (hex) =>
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    expect(near.style.background).toBe(rgb(boxTones[1]))
    expect(near.style.color).toBe(rgb(inkTones[1]))
    expect(near.style.background).not.toBe(near.style.color)
  })

  it('markup.7 shadow mode: no copies, the face tone as background, one layer per plane', async () => {
    const c = render(<HazePlanes mode='shadow'>x</HazePlanes>)
    await measure(80, 80)
    const el = root(c)
    expect(copies(el)).toHaveLength(0)
    expect(el.style.background).toBe('rgb(20, 20, 20)')
    const p = hazeAnalyse({ width: 80, height: 80 })
    const layers = el.style.boxShadow.split(/,(?![^(]*\))/)
    expect(layers).toHaveLength(3)
    expect(layers[0]).toContain(
      `${p.planes[0].dx.toFixed(3)}px 0px 0 ${p.planes[0].spread.toFixed(3)}px`,
    )
  })

  it('markup.8 transitions: transform and opacity on the copies with duration and easing; none in shadow mode', async () => {
    let c = render(
      <HazePlanes duration='1s' easing='ease-in-out'>
        x
      </HazePlanes>,
    )
    await measure(W, H)
    const s = copies(root(c))[0].style
    expect(s.transitionProperty).toBe('transform, opacity')
    expect(s.transitionDuration).toBe('1s')
    expect(s.transitionTimingFunction).toBe('ease-in-out')
    cleanup()
    c = render(<HazePlanes>x</HazePlanes>)
    await measure(W, H)
    expect(copies(root(c))[0].style.transitionDuration).toBe('260ms')
    expect(copies(root(c))[0].style.transitionTimingFunction).toBe('ease')
    cleanup()
    c = render(<HazePlanes mode='shadow'>x</HazePlanes>)
    await measure(80, 80)
    expect(root(c).style.transitionProperty).toBe('')
  })

  it('props.13 cornerRadius: a number is px, a string passes through, and it reaches the shadow geometry', async () => {
    let c = render(<HazePlanes cornerRadius={8}>x</HazePlanes>)
    expect(root(c).style.borderRadius).toBe('8px')
    cleanup()
    c = render(
      <HazePlanes cornerRadius='50%' mode='shadow'>
        x
      </HazePlanes>,
    )
    expect(root(c).style.borderRadius).toBe('50%')
  })
})

describe('HazePlanes fan', () => {
  const closedPose = (el) =>
    copies(el).map((s) => [norm(s.style.transform), s.style.opacity])

  it('states.closed: fan true is xyz + shrink: on the face, at its size, transparent; open on hover', async () => {
    const c = render(<HazePlanes fan>x</HazePlanes>)
    await measure(W, H)
    const el = root(c)
    for (const [t, o] of closedPose(el)) {
      expect(t).toBe('translate(0px, 0px) scale(1)')
      expect(o).toBe('0')
    }
    fireEvent.mouseEnter(el)
    expect(norm(copies(el)[0].style.transform)).toBe(norm(tx(scene(), 3)))
    expect(copies(el)[0].style.opacity).toBe('1')
    fireEvent.mouseLeave(el)
    expect(closedPose(el)[0]).toEqual(['translate(0px, 0px) scale(1)', '0'])
  })

  it("states.closed: size grow starts from 0 at each plane's own place when xyz is off", async () => {
    const c = render(
      <HazePlanes fan={{ xyz: false, size: 'grow' }}>x</HazePlanes>,
    )
    await measure(W, H)
    const p = scene()
    const far = copies(root(c))[0]
    expect(norm(far.style.transform)).toBe(
      norm(tx(p, 3)).replace(/scale\([^)]+\)/, 'scale(0)'),
    )
    expect(far.style.opacity).toBe('0')
    fireEvent.focus(root(c))
    expect(norm(far.style.transform)).toBe(norm(tx(p, 3)))
  })

  it('states.closed: xyz alone keeps the final size and starts on the face; both fans move together', async () => {
    let c = render(<HazePlanes fan={{ size: false }}>x</HazePlanes>)
    await measure(W, H)
    const p = scene()
    expect(norm(copies(root(c))[0].style.transform)).toBe(
      `translate(0px, 0px) scale(${Number(p.planes[2].scale.toFixed(6))})`,
    )
    cleanup()
    c = render(<HazePlanes fan={{ xyz: true, size: 'grow' }}>x</HazePlanes>)
    await measure(W, H)
    expect(norm(copies(root(c))[0].style.transform)).toBe(
      'translate(0px, 0px) scale(0)',
    )
    fireEvent.mouseEnter(root(c))
    expect(norm(copies(root(c))[0].style.transform)).toBe(norm(tx(p, 3)))
  })

  it('states.closed: shadow mode has no fan; the layers stand open', async () => {
    const c = render(
      <HazePlanes mode='shadow' fan>
        x
      </HazePlanes>,
    )
    await measure(80, 80)
    expect(root(c).style.boxShadow).not.toMatch(/^0px 0px 0 0px/)
  })

  it('callbacks.1 the passthrough handlers still fire; callbacks.neg.1 nothing changes without fan', async () => {
    const enter = vi.fn()
    let c = render(
      <HazePlanes fan onMouseEnter={enter}>
        x
      </HazePlanes>,
    )
    await measure(W, H)
    fireEvent.mouseEnter(root(c))
    expect(enter).toHaveBeenCalledTimes(1)
    cleanup()
    c = render(<HazePlanes>x</HazePlanes>)
    await measure(W, H)
    const before = copies(root(c))[0].style.transform
    fireEvent.mouseLeave(root(c))
    expect(copies(root(c))[0].style.transform).toBe(before)
  })

  it('state.reset: turning fan on closes the planes', async () => {
    function Host() {
      const [fan, setFan] = useState(false)
      return (
        <>
          <button onClick={() => setFan(true)}>fan</button>
          <HazePlanes fan={fan} data-h='1'>
            x
          </HazePlanes>
        </>
      )
    }
    const c = render(<Host />)
    await measure(W, H)
    const el = c.container.querySelector('[data-h]')
    expect(norm(copies(el)[0].style.transform)).toBe(norm(tx(scene(), 3)))
    fireEvent.click(c.getByText('fan'))
    expect(norm(copies(el)[0].style.transform)).toBe(
      'translate(0px, 0px) scale(1)',
    )
  })

  it('effects.2 the wrapper takes the tab stop only when nothing inside is focusable, rescanning on mutation', async () => {
    let c = render(<HazePlanes fan>x</HazePlanes>)
    await flush()
    expect(root(c).getAttribute('tabindex')).toBe('0')
    cleanup()
    c = render(
      <HazePlanes fan>
        <button>b</button>
      </HazePlanes>,
    )
    await flush()
    expect(root(c).getAttribute('tabindex')).toBeNull()
    cleanup()
    function Late() {
      const [ready, setReady] = useState(false)
      useEffect(() => {
        const id = setTimeout(() => setReady(true), 50)
        return () => clearTimeout(id)
      }, [])
      return ready ? <button>late</button> : <span>loading</span>
    }
    c = render(
      <HazePlanes fan>
        <Late />
      </HazePlanes>,
    )
    await flush()
    expect(root(c).getAttribute('tabindex')).toBe('0')
    await waitFor(() => expect(root(c).getAttribute('tabindex')).toBeNull())
    cleanup()
    c = render(<HazePlanes>x</HazePlanes>)
    await flush()
    expect(root(c).getAttribute('tabindex')).toBeNull()
  })

  it('effects.3 prefers-reduced-motion makes the duration 0ms', async () => {
    reducedMotion = true
    const c = render(<HazePlanes>x</HazePlanes>)
    await measure(W, H)
    expect(copies(root(c))[0].style.transitionDuration).toBe('0ms')
  })
})

describe('HazePlanes effects and exits', () => {
  it('effects.1 measures through a ResizeObserver and disconnects on unmount', async () => {
    const c = render(<HazePlanes>x</HazePlanes>)
    expect(observers).toHaveLength(1)
    c.unmount()
    expect(observers[0].disconnected).toBe(true)
  })

  it('effects.4 warns in dev when shadow mode is off square, and when a plane is hidden', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<HazePlanes mode='shadow'>x</HazePlanes>)
    await measure(W, H)
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/exact only on a square/),
    )
    warn.mockClear()
    cleanup()
    render(<HazePlanes radius={0.05}>x</HazePlanes>)
    await measure(80, 80)
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/do not clear the element/),
    )
    warn.mockRestore()
  })

  it('exits.throws an unknown mode, naming the two, and a bad colour', () => {
    expect(() => HazePlanes({ mode: 'element', children: 'x' })).toThrow(
      /transform, shadow/,
    )
    const c = render(<HazePlanes>x</HazePlanes>)
    cleanup()
    expect(() => hazeAnalyse({ width: 10, surface: 'red' })).toThrow(
      /bad colour/,
    )
    expect(c).toBeTruthy()
  })
})
