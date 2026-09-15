import fragmentShader from './glsl/poisson.frag?raw'
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
    divergence: {
      value: null,
    },
    px: {
      value: null,
    },
  },
}

export const poissonPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
