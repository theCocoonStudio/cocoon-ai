import fragmentShader from './glsl/viscous.frag?raw'
import vertexShader from './glsl/face.vert?raw'

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
}
