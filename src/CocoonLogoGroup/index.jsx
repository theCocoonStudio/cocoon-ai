import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { buildLogo } from './build.js'

/**
 * @typedef {import('three').Group} Group
 * @typedef {import('three').Mesh} Mesh
 * @typedef {import('three').BufferGeometry} BufferGeometry
 * @typedef {import('three').Material} Material
 */

/**
 * @typedef {object} LogoPiece
 * @property {Mesh | null} mesh
 * @property {BufferGeometry | null} geometry
 * @property {Material | null} material
 */

/**
 * @typedef {object} CocoonLogoGroupHandle
 * @property {Group | null} group          the root; null before mount
 * @property {LogoPiece[]} planes          front first, one per plane; members null before mount
 * @property {LogoPiece | null} wordmark   the wordmark in the lockup view; null in the icon view and before mount
 */

/**
 * @typedef {object} CocoonLogoGroupProps
 * @property {'lockup' | 'icon'} [view='lockup']   the icon left of the wordmark, or the icon alone
 * @property {number} [width=1]                     the ink's width, world units; the height follows the artwork
 * @property {number} [depth]                       z extent from the front faces to the back, bevels included; default a quarter of the ink height
 * @property {number} [maxSize=1000]                the widest the logo is expected to be drawn, px
 * @property {number} [eps=0.25]                    chord error allowed at maxSize when the outlines are simplified, px
 * @property {{ planes?: number, depth?: number, radius?: number, angle?: number, perspective?: number }} [scene]
 *   the plane recession, in the units of src/utils/hazePlanes.js; missing keys take the house scene
 * @property {'vapour' | 'dense'} [cut='vapour']    names the haze total
 * @property {number} [haze]                        overrides cut
 * @property {boolean} [reverse=false]              swaps surface and ground in the ramp
 * @property {string} [surface='#141414']           hex; the near end of the ramp
 * @property {string} [ground='#FFFFFF']            hex; the far end of the ramp, never painted
 * @property {number} [size=1]                      lockup: the icon's height in x-height bands
 * @property {number} [air=2]                       lockup: clear air in stems the derived gap must deliver
 * @property {number} [gap]                         lockup: the front-edge gap in stems, replacing the derivation
 * @property {object} [extrudeOptions]              merged over the extrusion defaults for every geometry
 * @property {false | object} [meshStandardMaterialProps=false]
 *   an object swaps every material for a meshStandardMaterial carrying those props
 * @property {object} [meshProps]                   spread last onto every mesh
 * @property {object} [materialProps]               spread last onto every material
 * @property {object} [geometryProps]               spread last onto every geometry; `dispose={null}` leaves disposal to you
 * @property {import('react').Ref<CocoonLogoGroupHandle>} [ref]
 */

const EMPTY = {}

/**
 * The cocoon logo as a group of extruded meshes: the four triangles, front
 * first, and in the lockup view the wordmark. Ink width `width` world units,
 * ink centred on the origin, front faces at z = 0, facing +z, y up. Nothing
 * runs per frame; move the group. Built from CocoonLogoGroup.spec.md.
 *
 * @param {CocoonLogoGroupProps & Record<string, any>} props the rest spreads onto the group
 */
export function CocoonLogoGroup({
  view = 'lockup',
  width = 1,
  depth,
  maxSize = 1000,
  eps = 0.25,
  scene,
  cut = 'vapour',
  haze,
  reverse = false,
  surface = '#141414',
  ground = '#FFFFFF',
  size = 1,
  air = 2,
  gap,
  extrudeOptions,
  meshStandardMaterialProps = false,
  meshProps = EMPTY,
  materialProps = EMPTY,
  geometryProps = EMPTY,
  ref,
  ...rest
}) {
  const groupRef = useRef(null)
  const meshesRef = useRef([])

  // Keyed on values, not object identity: a fresh `scene` or `extrudeOptions`
  // with the same numbers must not rebuild 20,000 vertices.
  const sceneKey = JSON.stringify(scene ?? null)
  const extrudeKey = JSON.stringify(extrudeOptions ?? null)
  const sceneValue = useMemo(() => JSON.parse(sceneKey), [sceneKey])
  const extrudeValue = useMemo(() => JSON.parse(extrudeKey), [extrudeKey])
  const logo = useMemo(
    () =>
      buildLogo({
        view,
        width,
        depth,
        maxSize,
        eps,
        scene: sceneValue,
        cut,
        haze,
        reverse,
        surface,
        ground,
        size,
        air,
        gap,
        extrudeOptions: extrudeValue,
      }),
    [
      view,
      width,
      depth,
      maxSize,
      eps,
      sceneValue,
      cut,
      haze,
      reverse,
      surface,
      ground,
      size,
      air,
      gap,
      extrudeValue,
    ],
  )

  // The geometries are this component's: released when a rebuild replaces
  // them and on unmount, unless the owner took disposal with dispose={null}.
  const ownsDisposal = geometryProps.dispose !== null
  useEffect(() => {
    const geometries = logo.pieces.map((p) => p.geometry)
    return () => {
      if (ownsDisposal) for (const g of geometries) g.dispose()
    }
  }, [logo, ownsDisposal])

  useImperativeHandle(ref, () => {
    const piece = (i) => ({
      get mesh() {
        return meshesRef.current[i] ?? null
      },
      get geometry() {
        return meshesRef.current[i]?.geometry ?? null
      },
      get material() {
        return meshesRef.current[i]?.material ?? null
      },
    })
    return {
      get group() {
        return groupRef.current
      },
      get planes() {
        return logo.pieces.filter((p) => p.k != null).map((_, i) => piece(i))
      },
      get wordmark() {
        const i = logo.pieces.findIndex((p) => p.k == null)
        return i < 0 || !meshesRef.current[i] ? null : piece(i)
      },
    }
  }, [logo])

  return (
    <group ref={groupRef} {...rest}>
      {logo.pieces.map((p, i) => (
        <mesh
          key={p.name}
          name={p.name}
          position={p.position}
          scale={p.width}
          ref={(mesh) => {
            meshesRef.current[i] = mesh
          }}
          {...meshProps}
        >
          <primitive object={p.geometry} attach='geometry' {...geometryProps} />
          {meshStandardMaterialProps ? (
            <meshStandardMaterial
              color={p.tone}
              {...meshStandardMaterialProps}
              {...materialProps}
            />
          ) : (
            <meshBasicMaterial
              color={p.tone}
              toneMapped={false}
              {...materialProps}
            />
          )}
        </mesh>
      ))}
    </group>
  )
}
