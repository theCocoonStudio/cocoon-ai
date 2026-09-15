import { AdditiveBlending, Vector2 } from 'three'
import fragmentShader from './glsl/controlForce.frag?raw'
import vertexShader from './glsl/controlForce.vert?raw'

const materialConfig = {
  vertexShader,
  fragmentShader,
  uniforms: {
    force: {
      value: new Vector2(0.0, 0.0),
    },
  },
  blending: AdditiveBlending,
}

export const meshForcePassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
}
