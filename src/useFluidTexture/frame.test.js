import { describe, expect, it, vi } from 'vitest'
import { FrameSplitter } from './frame.js'

describe('FrameSplitter', () => {
  for (const n of [1, 2, 3]) {
    it(`runs the callback on frame 0 and then every ${n}`, () => {
      const cb = vi.fn()
      const s = new FrameSplitter(cb, n)
      for (let i = 0; i < 6 * n; i++) s.frame(i)
      expect(cb).toHaveBeenCalledTimes(6)
      expect(cb.mock.calls.map((c) => c[0])).toEqual(
        Array.from({ length: 6 }, (_, k) => k * n),
      )
    })
  }

  it('passes every argument through', () => {
    const cb = vi.fn()
    new FrameSplitter(cb, 1).frame('state', 0.016, 'xr')
    expect(cb).toHaveBeenCalledWith('state', 0.016, 'xr')
  })

  it('set() swaps the callback or the period and restarts the count', () => {
    const a = vi.fn()
    const b = vi.fn()
    const s = new FrameSplitter(a, 3)
    s.frame()
    s.frame()
    s.set(b)
    s.frame() // count restarted: runs at once
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    s.set(undefined, 1)
    s.frame()
    s.frame()
    expect(b).toHaveBeenCalledTimes(3)
  })

  it('does nothing without a callback', () => {
    expect(() => new FrameSplitter(undefined, 2).frame()).not.toThrow()
  })
})
