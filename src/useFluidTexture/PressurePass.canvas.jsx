import fragmentShader from './glsl/pressure.frag?raw'
import vertexShader from './glsl/face.vert?raw'
import { boundaryChildren, disposeBoundary } from './boundary.js'

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

// The projection step is the frame's last write of velocity, so the wall
// draws here too: see boundary.js.
export const pressurePassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
  children: boundaryChildren,
  onDispose: disposeBoundary,
}
