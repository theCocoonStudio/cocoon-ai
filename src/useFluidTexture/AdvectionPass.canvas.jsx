import fragmentShader from './glsl/advection.frag?raw'
import vertexShader from './glsl/face.vert?raw'
import { boundaryChildren, disposeBoundary } from './boundary.js'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    boundarySpace: {
      value: null,
    },
    px: {
      value: null,
    },
    fboSize: {
      value: null,
    },
    velocity: {
      value: null,
    },
    dt: {
      value: null,
    },
    isBFECC: {
      value: null,
    },
  },
}

export const advectionPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
  children: boundaryChildren,
  onDispose: disposeBoundary,
}
