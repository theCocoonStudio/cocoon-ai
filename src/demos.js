// The demos entry, `cocoon-ai/demos`: the manifest, the wrapper, its hook,
// the effects enum, and one demo per component by name. Built as a second
// bundle so the main entry never carries a demo; a site reads `demos` for
// every demo with its facts (src/manifest.spec.md) or imports one by name.
// What a demo is: .claude/skills/demo/SKILL.md; the wrapper: docs/Demo.md.

export { demos } from './manifest.js'
export { Demo } from './Demo/index.jsx'
export { useSettings } from './Demo/useSettings.js'
export { EFFECTS } from './Demo/effects.js'
export { FluidTextureDemo } from './useFluidTexture/useFluidTexture.demo.jsx'
