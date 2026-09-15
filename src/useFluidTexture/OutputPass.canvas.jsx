import fragmentShader from './glsl/color.frag?raw'
import vertexShader from './glsl/output.vert?raw'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    velocity: {
      value: null,
    },
    px: {
      value: null,
    },
  },
}

export const outputPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
