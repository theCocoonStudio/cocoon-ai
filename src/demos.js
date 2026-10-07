// The demos entry, `cocoon-ai/demos`: the wrapper, its hook, the effects
// enum, and one demo per component. Built as a second bundle so the main
// entry never carries a demo; a site imports a demo by name from here.
// What a demo is: .claude/skills/demo/SKILL.md; the wrapper: docs/Demo.md.

export { Demo } from './Demo/index.jsx'
export { useSettings } from './Demo/useSettings.js'
export { EFFECTS } from './Demo/effects.js'
export {
  FluidTextureDemo,
  fluidDemoSchema,
} from './useFluidTexture/useFluidTexture.demo.jsx'
