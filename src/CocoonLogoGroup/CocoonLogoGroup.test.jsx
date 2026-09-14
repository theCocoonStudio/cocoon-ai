import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRef, useRef } from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Box3, Vector3 } from 'three'
import { performance } from 'node:perf_hooks'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hazeTones } from '../utils/hazePlanes.js'
import {
  grey,
  inkMargins,
  pixelDiff,
  rasterize,
} from '../../assets/lib/raster.js'
import { gapFor } from '../../assets/logo/build.js'
import { CocoonLogoGroup } from './index.jsx'
import { buildLogo, layoutLogo, resolveLogo } from './build.js'
import { LOGO } from './logo.js'

const here = dirname(fileURLToPath(import.meta.url))
const VAPOUR = ['#141414', '#C2C2C2', '#E5E5E5', '#F4F4F4']
const LOCKUP_SVG = join(
  here,
  '../../assets/logo/lockups/cocoon-lockup-icon1.00-air2x-vapour.svg',
)
/** The shipped lockup's ink aspect, measured off its raster: its viewBox is the sharp box, wider than the ink by the fillets. */
function lockupInkRatio(W = 4000) {
  const g = grey(rasterize(readFileSync(LOCKUP_SVG, 'utf8'), { width: W }))
  const m = inkMargins(g)
  return (g.width - m.l - m.r) / (g.height - m.t - m.b)
}
const LOCKUP_RATIO = lockupInkRatio()

async function mount(props = {}, extra = {}) {
  const handle = createRef()
  const renderer = await ReactThreeTestRenderer.create(
    <CocoonLogoGroup ref={handle} {...props} {...extra} />,
  )
  const group = renderer.scene.children[0].instance
  return { handle, renderer, group, meshes: group.children }
}

/** World-space box of everything under the group. */
function worldBox(group) {
  group.updateMatrixWorld(true)
  return new Box3().setFromObject(group)
}

afterEach(() => vi.restoreAllMocks())

describe('CocoonLogoGroup', () => {
  it('[markup.1] [props.passthrough] renders a group and spreads the rest onto it', async () => {
    const { group } = await mount({ position: [1, 2, 3], name: 'nav-logo' })
    expect(group.isGroup).toBe(true)
    expect(group.position.toArray()).toEqual([1, 2, 3])
    expect(group.name).toBe('nav-logo')
  })

  it('[markup.2] [markup.3] [states.default] holds four planes front first and then the wordmark', async () => {
    const { meshes } = await mount()
    expect(meshes.map((m) => m.name)).toEqual([
      'plane0',
      'plane1',
      'plane2',
      'plane3',
      'wordmark',
    ])
    for (const m of meshes) expect(m.isMesh).toBe(true)
  })

  it('[props.1] [states.icon] renders the planes alone in the icon view', async () => {
    const { meshes } = await mount({ view: 'icon' })
    expect(meshes.map((m) => m.name)).toEqual([
      'plane0',
      'plane1',
      'plane2',
      'plane3',
    ])
  })

  it('[markup.4] normalises and centres every geometry: larger xy extent 1, centred on all three axes', async () => {
    const { meshes } = await mount()
    for (const m of meshes) {
      const bb = m.geometry.boundingBox
      const w = bb.max.x - bb.min.x
      const h = bb.max.y - bb.min.y
      expect(Math.max(w, h)).toBeCloseTo(1, 6)
      expect(bb.max.x + bb.min.x).toBeCloseTo(0, 6)
      expect(bb.max.y + bb.min.y).toBeCloseTo(0, 6)
      expect(bb.max.z + bb.min.z).toBeCloseTo(0, 6)
    }
  })

  it('[markup.4] scales each mesh uniformly by its world width', async () => {
    const { meshes } = await mount()
    for (const m of meshes) {
      expect(m.scale.x).toBe(m.scale.y)
      expect(m.scale.y).toBe(m.scale.z)
      const bb = m.geometry.boundingBox
      expect((bb.max.x - bb.min.x) * m.scale.x).toBeGreaterThan(0)
    }
  })

  it('[props.2] [markup.7] [markup.8] makes the ink 1 wide by default, centred on the origin, at the shipped lockup aspect', async () => {
    const { group } = await mount()
    const box = worldBox(group)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    // The simplified ink sits within eps of the dense outline: 0.25 px at 1000 px, each side.
    const tol = (2 * 0.25) / 1000
    expect(Math.abs(size.x - 1)).toBeLessThan(tol)
    expect(
      Math.abs(size.x / size.y - LOCKUP_RATIO) / LOCKUP_RATIO,
    ).toBeLessThan(2e-3)
    expect(Math.abs(centre.x)).toBeLessThan(tol)
    expect(Math.abs(centre.y)).toBeLessThan(tol)
  })

  it('[props.2] scales the whole group with width', async () => {
    const { group } = await mount({ width: 3 })
    const size = worldBox(group).getSize(new Vector3())
    expect(Math.abs(size.x - 3)).toBeLessThan((3 * 2 * 0.25) / 1000)
    expect(
      Math.abs(size.x / size.y - LOCKUP_RATIO) / LOCKUP_RATIO,
    ).toBeLessThan(2e-3)
  })

  it('[markup.7] [markup.8] puts every front face at z = 0 and the backs at -depth: the last plane and the wordmark end together', async () => {
    const { group, meshes } = await mount()
    const box = worldBox(group)
    expect(box.max.z).toBeCloseTo(0, 6)
    const { depth } = buildLogo()
    expect(box.min.z).toBeCloseTo(-depth, 6)
    const zRange = (m) => {
      m.updateMatrixWorld(true)
      const b = new Box3().setFromObject(m)
      return [b.min.z, b.max.z]
    }
    const n = 4
    meshes.slice(0, n).forEach((m, k) => {
      const [z0, z1] = zRange(m)
      expect(z1).toBeCloseTo((-k * depth) / n, 6)
      expect(z0).toBeCloseTo((-(k + 1) * depth) / n, 6)
    })
    const [w0, w1] = zRange(meshes[4])
    expect(w1).toBeCloseTo(0, 6)
    expect(w0).toBeCloseTo(-depth, 6)
  })

  it('[props.3] defaults depth to a quarter of the ink height and takes an override', async () => {
    const a = buildLogo()
    expect(a.depth).toBeCloseTo(a.height / 4, 9)
    const { group } = await mount({ depth: 0.2 })
    expect(worldBox(group).min.z).toBeCloseTo(-0.2, 6)
  })

  it('[markup.9] stands the mark up: the triangle points up and right, the wordmark reads left to right', () => {
    const ys = LOGO.triangle.sharp.map((p) => p[1])
    const top = Math.max(...ys)
    expect(ys.filter((y) => Math.abs(y - top) < 1e-6)).toHaveLength(2) // the top edge is horizontal
    const [sharpVertex] = LOGO.triangle.sharp
    expect(sharpVertex[0]).toBeGreaterThan(0) // and its sharp vertex is on the right
    const L = buildLogo()
    const p0 = L.pieces[0].position
    const wm = L.pieces[4].position
    expect(p0[0]).toBeLessThan(wm[0]) // icon left of the wordmark
    expect(L.pieces[1].position[0]).toBeGreaterThan(p0[0]) // the trail recedes right
  })

  it('[markup.6] gives each plane its tone from the ramp and the wordmark tone 0, on an untonemapped basic material', async () => {
    const { meshes } = await mount()
    const hex = (m) => `#${m.material.color.getHexString().toUpperCase()}`
    expect(meshes.slice(0, 4).map(hex)).toEqual(VAPOUR)
    expect(hex(meshes[4])).toBe(VAPOUR[0])
    for (const m of meshes) {
      expect(m.material.isMeshBasicMaterial).toBe(true)
      expect(m.material.toneMapped).toBe(false)
    }
  })

  it('[props.7] [props.8] [props.9] [props.10] [props.11] recolours from cut, haze, reverse, surface and ground', async () => {
    const hexes = async (props) => {
      const { meshes } = await mount(props)
      return meshes
        .slice(0, 4)
        .map((m) => `#${m.material.color.getHexString().toUpperCase()}`)
    }
    expect(await hexes({ cut: 'dense', ground: '#E8E8E8' })).toEqual(
      hazeTones({ cut: 'dense', surface: '#141414', ground: '#E8E8E8' }),
    )
    expect(await hexes({ reverse: true })).toEqual(
      hazeTones({ cut: 'vapour', surface: '#FFFFFF', ground: '#141414' }),
    )
    expect(await hexes({ haze: 0.5 })).toEqual(
      hazeTones({ haze: 0.5, surface: '#141414', ground: '#FFFFFF' }),
    )
    expect(await hexes({ surface: '#FF0000', ground: '#0000FF' })).toEqual(
      hazeTones({ cut: 'vapour', surface: '#FF0000', ground: '#0000FF' }),
    )
  })

  it('[props.16] [states.standard] swaps in a standard material carrying the given props, tone kept', async () => {
    const { meshes } = await mount({
      meshStandardMaterialProps: { roughness: 0.2, metalness: 0.8 },
    })
    for (const m of meshes) {
      expect(m.material.isMeshStandardMaterial).toBe(true)
      expect(m.material.roughness).toBe(0.2)
      expect(m.material.metalness).toBe(0.8)
      expect(m.material.toneMapped).toBe(true)
    }
    expect(meshes[1].material.color.getHexString().toUpperCase()).toBe('C2C2C2')
  })

  it("[props.17] [props.18] [props.19] spread meshProps, materialProps and geometryProps last, over the component's own", async () => {
    const { meshes } = await mount({
      meshProps: { visible: false, userData: { tag: 'logo' } },
      materialProps: { color: '#00FF00', toneMapped: true },
      geometryProps: { name: 'ink' },
    })
    for (const m of meshes) {
      expect(m.visible).toBe(false)
      expect(m.userData.tag).toBe('logo')
      expect(m.material.color.getHexString().toUpperCase()).toBe('00FF00')
      expect(m.material.toneMapped).toBe(true)
      expect(m.geometry.name).toBe('ink')
    }
  })

  it('[props.6] takes the scene: three planes, and angle 90 sends the trail down', async () => {
    const { meshes } = await mount({ scene: { planes: 3 } })
    expect(meshes.map((m) => m.name)).toEqual([
      'plane0',
      'plane1',
      'plane2',
      'wordmark',
    ])
    const down = layoutLogo(resolveLogo({ view: 'icon', scene: { angle: 90 } }))
    expect(down.pieces[1].offset[0]).toBeCloseTo(0, 9)
    expect(down.pieces[1].offset[1]).toBeLessThan(0)
    const right = layoutLogo(resolveLogo({ view: 'icon' }))
    expect(right.pieces[1].offset[1]).toBeCloseTo(0, 9)
    expect(right.pieces[1].offset[0]).toBeGreaterThan(0)
  })

  it('[props.6] draws a lone plane in the surface colour', () => {
    const one = buildLogo({ view: 'icon', scene: { planes: 1 } })
    expect(one.pieces).toHaveLength(1)
    expect(one.tones).toEqual(['#141414'])
  })

  it('[props.13] [markup.8] derives the gap by the shipped rule: the shipped tiers at the shipped sizes', () => {
    for (const size of LOGO.sizes)
      for (const air of [1, 2, 3])
        expect(buildLogo({ size, air }).gap, `size ${size} air ${air}`).toBe(
          gapFor(air),
        )
  })

  it('[props.13] [props.14] [props.12] a larger icon lengthens the trail and the gap follows; gap given wins; size scales the icon', () => {
    const big = buildLogo({ size: 1.5, air: 2 })
    expect(big.gap).toBeGreaterThan(gapFor(2))
    const given = buildLogo({ gap: 3 })
    expect(given.gap).toBe(3)
    const near = given.pieces[0].position[0]
    const far = buildLogo({ gap: 9 }).pieces[0].position[0]
    expect(near).toBeGreaterThan(far) // a smaller gap keeps the icon closer to the wordmark
    const w = (props) => buildLogo(props).pieces[0].width
    expect(w({ size: 1.1 }) / w({ size: 1 })).toBeGreaterThan(1)
  })

  it('[props.4] [props.5] [markup.10] simplifies the outlines to eps at maxSize: coarser settings mean fewer vertices, and eps 0 keeps them all', () => {
    const count = (props) =>
      buildLogo(props).pieces.reduce(
        (a, p) => a + p.geometry.attributes.position.count,
        0,
      )
    const base = count({})
    expect(count({ eps: 2 })).toBeLessThan(base)
    expect(count({ maxSize: 200 })).toBeLessThan(base)
    expect(count({ eps: 0 })).toBeGreaterThan(base)
  })

  it('[markup.5] [props.15] extrudes with a small inset bevel by default and merges extrudeOptions last', () => {
    const { pieces, depth } = buildLogo()
    for (const p of pieces) {
      const e = p.extrude
      expect(e.bevelEnabled).toBe(true)
      expect(e.bevelOffset).toBeCloseTo(-e.bevelSize, 12)
      expect(e.bevelThickness).toBe(e.bevelSize)
      expect(e.steps).toBe(1)
      // the bevel is 0.3 of one triangle's depth, in this piece's own units
      expect(e.bevelSize * p.width).toBeCloseTo(0.3 * (depth / 4), 9)
      // and the piece's total z extent is its depth
      expect((e.depth + 2 * e.bevelThickness) * p.width).toBeCloseTo(p.depth, 9)
    }
    const flat = buildLogo({ extrudeOptions: { bevelEnabled: false } })
    for (const p of flat.pieces) expect(p.extrude.bevelEnabled).toBe(false)
  })

  it('[markup.4] [markup.10] matches the shipped lockup when its faces are drawn flat, bevel off', () => {
    const W = 800
    const { pieces, layout } = buildLogo({
      maxSize: W,
      extrudeOptions: { bevelEnabled: false },
    })
    let polys = ''
    for (const p of [...pieces].reverse()) {
      // back to front: SVG paints in order
      const g = p.geometry
      const pos = g.attributes.position
      const zFront = g.boundingBox.max.z
      const [px, py] = p.position
      for (let t = 0; t + 2 < pos.count; t += 3) {
        const tri = [t, t + 1, t + 2]
        if (tri.some((i) => Math.abs(pos.getZ(i) - zFront) > 1e-9)) continue
        const pts = tri.map(
          (i) =>
            `${(pos.getX(i) * p.width + px).toFixed(5)},${(-(pos.getY(i) * p.width) - py).toFixed(5)}`,
        )
        polys += `<polygon points="${pts.join(' ')}" fill="${p.tone}"/>`
      }
    }
    // The shipped file's viewBox, the sharp box in font units, carried into world units so the two rasters align.
    const shipped = readFileSync(LOCKUP_SVG, 'utf8')
    const [vx, vy, vw, vh] = shipped
      .match(/viewBox="([^"]+)"/)[1]
      .split(' ')
      .map(Number)
    const { perUnit, centre } = layout
    const x0 = (vx - centre[0]) * perUnit
    const y0 = -(-vy - centre[1]) * perUnit // SVG y-down top edge is font y-up max
    const mesh =
      `<svg viewBox="${x0} ${y0} ${vw * perUnit} ${vh * perUnit}" xmlns="http://www.w3.org/2000/svg">` +
      `<g>${polys}</g></svg>`
    const a = grey(rasterize(mesh, { width: W }))
    const b = grey(rasterize(shipped, { width: W }))
    const { fraction } = pixelDiff(a, b)
    expect(fraction).toBeLessThan(0.01)
  })

  it('[contracts.1] builds the default lockup in under 20 ms, median of five', () => {
    const times = []
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      const L = buildLogo()
      times.push(performance.now() - t0)
      for (const p of L.pieces) p.geometry.dispose()
    }
    times.sort((a, b) => a - b)
    expect(times[2]).toBeLessThan(20)
  })

  it("[handle.1] [handle.2] [handle.3] exposes the group, each plane's mesh, geometry and material, and the wordmark", async () => {
    const { handle, group, meshes } = await mount()
    const h = handle.current
    expect(h.group).toBe(group)
    expect(h.planes).toHaveLength(4)
    h.planes.forEach((p, k) => {
      expect(p.mesh).toBe(meshes[k])
      expect(p.geometry).toBe(meshes[k].geometry)
      expect(p.material).toBe(meshes[k].material)
    })
    expect(h.wordmark.mesh).toBe(meshes[4])
    expect(h.wordmark.geometry).toBe(meshes[4].geometry)
    expect(h.wordmark.material).toBe(meshes[4].material)
  })

  it('[handle.3] has no wordmark in the icon view', async () => {
    const { handle } = await mount({ view: 'icon' })
    expect(handle.current.wordmark).toBeNull()
    expect(handle.current.planes).toHaveLength(4)
  })

  it('[dispose.geometry.plane<k>] [dispose.geometry.wordmark] [dispose.material.plane<k>] [dispose.material.wordmark] disposes every geometry and material on unmount', async () => {
    const { renderer, meshes } = await mount()
    const spies = meshes.flatMap((m) => [
      vi.spyOn(m.geometry, 'dispose'),
      vi.spyOn(m.material, 'dispose'),
    ])
    await renderer.unmount()
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1)
  })

  it('[dispose.geometry.plane<k>] disposes the replaced geometries on a rebuild, and not the new ones', async () => {
    const handle = createRef()
    const renderer = await ReactThreeTestRenderer.create(
      <CocoonLogoGroup ref={handle} width={1} />,
    )
    const old = handle.current.planes.map((p) => p.geometry)
    const spies = old.map((g) => vi.spyOn(g, 'dispose'))
    await renderer.update(<CocoonLogoGroup ref={handle} width={2} />)
    const fresh = handle.current.planes.map((p) => p.geometry)
    fresh.forEach((g, i) => expect(g).not.toBe(old[i]))
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1)
    const freshSpies = fresh.map((g) => vi.spyOn(g, 'dispose'))
    for (const s of freshSpies) expect(s).not.toHaveBeenCalled()
  })

  it('[dispose.geometry.plane<k>] does not rebuild when an unrelated prop or an equal scene object changes', async () => {
    const handle = createRef()
    const renderer = await ReactThreeTestRenderer.create(
      <CocoonLogoGroup ref={handle} scene={{ planes: 4 }} />,
    )
    const before = handle.current.planes.map((p) => p.geometry)
    await renderer.update(
      <CocoonLogoGroup
        ref={handle}
        scene={{ planes: 4 }}
        meshProps={{ userData: { tick: 1 } }}
        position={[1, 0, 0]}
      />,
    )
    handle.current.planes.forEach((p, i) => expect(p.geometry).toBe(before[i]))
  })

  it('[props.19] [dispose.geometry.plane<k>] leaves disposal to the owner under geometryProps dispose null', async () => {
    const { renderer, meshes } = await mount({
      geometryProps: { dispose: null },
    })
    const spies = meshes.map((m) => vi.spyOn(m.geometry, 'dispose'))
    await renderer.unmount()
    for (const s of spies) expect(s).not.toHaveBeenCalled()
  })

  it('[frame.writes-react] renders nothing across frames', async () => {
    let renders = 0
    function Probe() {
      renders++
      return <CocoonLogoGroup />
    }
    const renderer = await ReactThreeTestRenderer.create(<Probe />)
    const after = renders
    await renderer.advanceFrames(10, 16)
    expect(renders).toBe(after)
  })

  it('[exits.throws] refuses a bad view, colour, width, eps, size or scene, naming it', async () => {
    const fails = async (props, re) => {
      let error = null
      try {
        await ReactThreeTestRenderer.create(<CocoonLogoGroup {...props} />)
      } catch (e) {
        error = e
      }
      expect(error, JSON.stringify(props)).not.toBeNull()
      expect(error.message).toMatch(re)
    }
    await fails({ view: 'wordmark' }, /view/)
    await fails({ surface: 'black' }, /colour/)
    await fails({ width: 0 }, /width/)
    await fails({ eps: -1 }, /eps/)
    await fails({ size: 0 }, /size/)
    await fails({ scene: { planes: 0 } }, /planes/)
    await fails({ cut: 'thick' }, /cut/)
  })

  it('[library.export] is exported from src/index.js', async () => {
    const mod = await import('../index.js')
    expect(mod.CocoonLogoGroup).toBe(CocoonLogoGroup)
  })

  it('[library.helper] resolveLogo fills the scene from the house defaults and layoutLogo reports the measures', () => {
    const o = resolveLogo({ scene: { radius: 0.5 } })
    expect(o.scene).toEqual({
      planes: 4,
      depth: 2 / 3,
      radius: 0.5,
      angle: 0,
      perspective: 1 / 6,
    })
    const L = layoutLogo(resolveLogo())
    expect(L.pieces.map((p) => p.name)).toEqual([
      'plane0',
      'plane1',
      'plane2',
      'plane3',
      'wordmark',
      'wordmark',
      'wordmark',
      'wordmark',
      'wordmark',
    ])
    expect(L.gap).toBe(7)
  })

  it('[refs.2] handle members are null before mount and read through refs after', () => {
    // Read during render: the handle has nothing yet.
    let seen = 'unset'
    function Probe() {
      const ref = useRef(null)
      seen = ref.current
      return <CocoonLogoGroup ref={ref} />
    }
    return ReactThreeTestRenderer.create(<Probe />).then((r) => {
      expect(seen).toBeNull()
      return r.unmount()
    })
  })
})
