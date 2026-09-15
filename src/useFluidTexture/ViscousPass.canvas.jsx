import fragmentShader from './glsl/viscous.frag?raw'
import vertexShader from './glsl/face.vert?raw'
import { boundaryChildren, disposeBoundary } from './boundary.js'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    boundarySpace: {
      value: null,
    },
    velocity: {
      value: null,
    },
    velocity_new: {
      value: null,
    },
    v: {
      value: null,
    },
    px: {
      value: null,
    },
    dt: {
      value: null,
    },
  },
}

export const viscousPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
  children: boundaryChildren,
  onDispose: disposeBoundary,
}
