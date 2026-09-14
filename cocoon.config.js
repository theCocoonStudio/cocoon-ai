/**
 * The studio's design defaults, in one place.
 *
 * Everything that draws the mark, the icon set, the lockup or the logo mesh
 * reads from here, and nothing restates a number: the scene module, the haze
 * engine, the logo and icon builds, the export scripts and the components
 * import this file. Change a value, then `npm run assets` and `npm test`. A
 * scene change moves the four plain icon files, which the logo build refuses
 * to overwrite; delete them first, as assets/logo/README.md says.
 *
 * Units are the ones the readers state: the scene in src/utils/hazePlanes.js,
 * the mark and the favicon in assets/logo/cocoon-logo-spec.md, the icons in
 * assets/icons/cocoon-icon-set-spec.md. Derived numbers, the wordmark's stem
 * and x-height, the lockup gaps, the tone ramps, are computed from these and
 * do not appear here.
 */
export const config = /* @__PURE__ */ Object.freeze({
  /** The plane recession: a count and four numbers, none redundant. */
  scene: {
    planes: 4,
    depth: 2 / 3, // the last plane's size as a fraction of the front face
    radius: 1.9 / 3, // the last plane's centre from the front's, in widths; the old 1.90 camera offset
    angle: 0, // degrees, 0 right, 90 down, as CSS rotates
    perspective: 1 / 6, // foreshortening of the middle planes; 0 is equal steps
  },
  /** The ink, and the two cuts: the haze total each spreads over the row, and the ground each fades toward. */
  ink: '#141414',
  cut: 'vapour', // the default cut
  cuts: {
    vapour: { haze: 0.1, ground: '#FFFFFF' }, // 0.275² until 2026-09-06
    dense: { haze: 0.15 ** 2, ground: '#E8E8E8' },
  },
  /** The four-triangle mark. */
  mark: {
    apex: 48, // degrees at the sharp vertex; 60 would be equilateral
    corner: 0.02, // fillet radius on the front shape, as a fraction of the 1000 box
    squarePad: 60, // clear margin on the square canvases, design units
  },
  /** The wordmark's instance of Saira. */
  wordmark: { wght: 350, wdth: 107 },
  /** The lockup: the shipped icon sizes and clear-air tiers, and the defaults a single lockup takes. */
  lockup: {
    sizes: [0.9, 1.0, 1.1], // icon height in x-height bands
    airTiers: [1, 2, 3], // clear air in wordmark stems
    size: 1.0,
    air: 2,
  },
  /** The favicon tile. */
  favicon: {
    size: 1000,
    radius: 220,
    margin: 0.15, // least clear air between any ink and the tile edge; 0.1 until 2026-09-05
    light: '#FFFFFF', // ground of the light version; the tile has no edge on white chrome, by decision
    dark: '#141414', // ground of the dark version
  },
  /** The icon set. */
  icons: {
    bar: 0.15, // the stroke every stroke-built icon shares, as a fraction of the 1000 box
  },
  /** CocoonLogoGroup, the logo mesh. */
  logoGroup: {
    width: 1, // ink width, world units
    maxSize: 1000, // widest expected draw, px
    eps: 0.25, // chord error allowed at maxSize, px
    depthRatio: 1 / 4, // z extent as a fraction of the ink height, when depth is unset
    bevelRatio: 0.3, // bevel radius as a fraction of one triangle's depth
    bevelSegments: 3,
  },
  /** export:logo-group's camera and sheet. */
  logoGroupExport: {
    fov: 20, // vertical field of view, degrees
    fill: 0.9, // fraction of the head-on view the ink fills
    yaw: 35, // the turned cells' rotation about y, degrees
    pitch: 20, // and about x
    light: [-0.4, 0.6, 1], // where the directional light comes from, lit cells only
    ambient: 0.6,
    cell: 900, // cell width, px
  },
})
