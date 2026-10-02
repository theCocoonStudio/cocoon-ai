// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SectionFeature } from './SectionFeature'

afterEach(() => {
  cleanup()
})

// the scroll element: 50 high, 150 of content, a static container with three sections of 50
function sizedContainer() {
  const { container } = render(
    <div>
      <div>
        <div />
        <div />
        <div />
      </div>
    </div>,
  )
  const el = container.firstChild
  const def = (node, k, v) =>
    Object.defineProperty(node, k, { configurable: true, value: v })
  def(el, 'clientHeight', 50)
  def(el, 'scrollHeight', 150)
  def(el.children[0], 'clientHeight', 150)
  for (const c of el.children[0].children) def(c, 'clientHeight', 50)
  return el
}

describe('static methods', () => {
  it('getSectionData: one range per section; the section visible at 0 is done at 0', () => {
    const [first, second, third] = SectionFeature.getSectionData(
      sizedContainer(),
      150,
      50,
    )

    expect(first.min).toBe(0)
    expect(first.max).toBe(0)
    expect(first.computeSectionOffset(0)).toBe(1.0)
    expect(first.computeSectionOffset(50)).toBe(1.0)
    expect(second.min).toBe(0)
    expect(second.max).toBe(50)
    expect(second.computeSectionOffset(0)).toBe(0.0)
    expect(second.computeSectionOffset(25)).toBe(0.5)
    expect(second.computeSectionOffset(50)).toBe(1.0)
    expect(third.min).toBe(50)
    expect(third.max).toBe(100)
    expect(third.computeSectionOffset(0)).toBe(0.0)
    expect(third.computeSectionOffset(25)).toBe(0.0)
    expect(third.computeSectionOffset(50)).toBe(0.0)
    expect(third.computeSectionOffset(75)).toBe(0.5)
    expect(third.computeSectionOffset(100)).toBe(1.0)
  })

  it('getSectionData rejects a missing container or bad heights without throwing', () => {
    expect(SectionFeature.getSectionData(undefined, 150, 50)).toBeUndefined()
    expect(
      SectionFeature.getSectionData(sizedContainer(), 0, 50),
    ).toBeUndefined()
    expect(
      SectionFeature.getSectionData(sizedContainer(), 150, 'x'),
    ).toBeUndefined()
  })

  it('exits.throws cumulative section heights above the scroll height throw', () => {
    expect(() =>
      SectionFeature.getSectionData(sizedContainer(), 90, 50),
    ).toThrow(/exceed/)
  })
})

describe('instance', () => {
  it('state.5 constructs with a valid container, index 0 at scrollTop 0', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    expect(f.activeSectionIndex).toBe(0)
    expect(f.activeSectionOffset).toBe(1.0)
    expect(f.scrollDistance).toBe(100)
  })

  it('state.5 constructs with no container and stays inert', () => {
    const f = new SectionFeature(undefined, 0, 0)
    expect(f.inputs.sectionContainer).toBeUndefined()
  })

  it('callbacks.2 setScrollTop sets the index and the offset, and calls back once per change', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    const calls = []
    f.setScrollTop(25, (i, o) => calls.push([i, o]))
    f.setScrollTop(30, (i, o) => calls.push([i, o]))
    f.setScrollTop(75, (i, o) => calls.push([i, o]))
    expect(f.activeSectionIndex).toBe(2)
    expect(f.activeSectionOffset).toBe(0.5)
    expect(calls).toEqual([
      [1, 0.5],
      [2, 0.5],
    ])
  })

  it('callbacks.2 a setter that changes the section does not need a callback', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    expect(() => {
      f.scrollTop = 75
    }).not.toThrow()
    expect(f.activeSectionIndex).toBe(2)
    expect(f.scrollTop).toBe(75)
  })

  it('exits.throws a scrollTop outside every range throws', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    expect(() => f.setScrollTop(101)).toThrow(/outside section range/)
  })

  it('state.5 sectionData and data return arrays, not index-keyed objects', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    expect(Array.isArray(f.sectionData)).toBe(true)
    expect(f.sectionData.length).toBe(3)
    expect(Array.isArray(f.data.sectionData)).toBe(true)
    expect(f.data.scrollTop).toBe(0)
    expect(f.data.activeSectionIndex).toBe(0)
  })

  it('effects.2 update with new heights recomputes the ranges at the current scrollTop', () => {
    const f = new SectionFeature(sizedContainer(), 150, 50)
    f.setScrollTop(75)
    const el = sizedContainer()
    f.update(el, 150, 50, 75)
    expect(f.activeSectionIndex).toBe(2)
    expect(f.inputs.sectionContainer).toBe(el)
  })
})
