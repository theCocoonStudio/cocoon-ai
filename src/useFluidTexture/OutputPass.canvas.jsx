import { Vector2 } from 'three'
import fragmentShader from './glsl/color.frag?raw'
import vertexShader from './glsl/face.vert?raw'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    velocity: {
      value: null,
    },
    boundarySpace: {
      value: new Vector2(),
    },
  },
}

export const outputPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
