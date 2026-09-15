import {
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  RawShaderMaterial,
} from 'three'
import fragmentShader from './glsl/advection.frag?raw'
import vertexShader from './glsl/face.vert?raw'
import lineVert from './glsl/line.vert?raw'
import lineFrag from './glsl/boundary.frag?raw'

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

const children = () => {
  const boundaryMaterialConfig = {
    vertexShader: lineVert,
    fragmentShader: lineFrag,
    uniforms: materialConfig.uniforms,
  }
  // boundary buffer attribute
  const positionBuffer = new Float32Array([
    // left
    -1, -1, 0, -1, 1, 0,

    // top
    -1, 1, 0, 1, 1, 0,

    // right
    1, 1, 0, 1, -1, 0,

    // bottom
    1, -1, 0, -1, -1, 0,
  ])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positionBuffer, 3))
  const material = new RawShaderMaterial(boundaryMaterialConfig)
  const boundary = new LineSegments(geometry, material)
  /* boundary.renderOrder = 0
  pass.mesh.renderOrder = 1 */
  return boundary
}

const onDispose = (children) => {
  children.geometry.dispose()
  children.material.dispose()
}

export const advectionPassConfig = {
  materialConfig,
  fboConfig: { isNull: true },
  children,
  onDispose,
}
