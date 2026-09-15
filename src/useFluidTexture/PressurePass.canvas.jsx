import fragmentShader from './glsl/pressure.frag?raw'
import vertexShader from './glsl/face.vert?raw'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    boundarySpace: {
      value: null,
    },
    pressure: {
      value: null,
    },
    velocity: {
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

export const pressurePassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
