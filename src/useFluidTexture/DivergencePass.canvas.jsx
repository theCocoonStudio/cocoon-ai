import fragmentShader from './glsl/divergence.frag?raw'
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
    dt: {
      value: null,
    },
    px: {
      value: null,
    },
  },
}

export const divergencePassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
