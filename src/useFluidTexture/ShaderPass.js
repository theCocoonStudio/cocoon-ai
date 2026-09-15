import {
  Camera,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three'

export class ShaderPass {
  #fbo
  #children
  #onDispose
  #uniforms = {}
  #onBeforeRender
  #onAfterRender
  #geometry
  #mesh
  #camera
  constructor({
    materialConfig: {
      vertexShader,
      fragmentShader,
      uniforms = {},
      raw = false,
      ...materialProps
    },
    material,
    geometry,
    camera,
    onBeforeRender,
    onAfterRender,
    fboConfig: { width, height, options, isNull = false },
    fbo,
    children,
    onDispose,
  }) {
    if (material) {
      this.material = typeof material === 'function' ? material() : material
    } else if (material !== null) {
      this.material = raw
        ? new RawShaderMaterial({
            uniforms: {},
            vertexShader,
            fragmentShader,
            ...materialProps,
          })
        : new ShaderMaterial({
            uniforms: {},
            vertexShader,
            fragmentShader,
            ...materialProps,
          })
      this.updateUniforms(uniforms, true)
    }
    if (geometry) {
      this.#geometry = typeof geometry === 'function' ? geometry() : geometry
    } else if (geometry !== null) {
      this.#geometry = new PlaneGeometry(2.0, 2.0)
    }

    this.#mesh = new Mesh(this.#geometry, this.material)

    this.updateCamera(camera)

    this.scene = new Scene()
    this.scene.add(this.mesh)

    if (children) {
      this.#children =
        typeof children === 'function' ? children(this) : children
      this.scene.add(this.#children)
    }

    if (typeof onBeforeRender === 'function') {
      this.#onBeforeRender = onBeforeRender
    }
    if (typeof onAfterRender === 'function') {
      this.#onAfterRender = onAfterRender
    }
    if (fbo) {
      this.#fbo = fbo
    } else if (!isNull) {
      this.#fbo = new WebGLRenderTarget(width, height, options)
    } else {
      this.#fbo = null
    }

    this.#onDispose = onDispose
  }

  dispose(material = true, geometry = true, fbo = true, onDispose = true) {
    material && this.material.dispose()
    geometry && this.#geometry.dispose()
    fbo && this.#fbo.dispose()
    if (onDispose && typeof this.#onDispose === 'function') {
      this.#onDispose(this.#children)
    }
  }

  setFBO(fbo) {
    this.#fbo = fbo
    return this
  }

  get fbo() {
    return this.#fbo
  }

  setOnBeforeRender(func) {
    this.#onBeforeRender = func
    return this
  }

  get onBeforeRender() {
    return this.#onBeforeRender
  }

  setOnAfterRender(func) {
    this.#onAfterRender = func
    return this
  }

  get onAfterRenderRender() {
    return this.#onAfterRender
  }

  get uniforms() {
    return this.#uniforms
  }

  get children() {
    return this.#children
  }
  modifyChildren(callback) {
    if (this.#children) {
      callback(this.#children)
    }
    return this
  }

  get geometry() {
    return this.#geometry
  }

  get mesh() {
    return this.#mesh
  }

  updateGeometry(newGeometry, dispose = false) {
    const old = this.#geometry
    if (newGeometry) {
      this.#geometry =
        typeof newGeometry === 'function' ? newGeometry() : newGeometry
    } else if (newGeometry !== null) {
      this.#geometry = new PlaneGeometry(2.0, 2.0)
    }
    this.#mesh.geometry = this.#geometry
    dispose && old?.dispose()
    return this
  }

  updateUniforms(uniforms = {}, fresh = false) {
    if (fresh) {
      this.#uniforms = {}
    }
    for (const property in uniforms) {
      this.#uniforms[property] = uniforms[property]
      this.material.uniforms = this.#uniforms
    }
    return this
  }

  updateCamera(newCamera) {
    if (newCamera) {
      this.#camera = typeof newCamera === 'function' ? newCamera() : newCamera
    } else if (newCamera !== null) {
      this.#camera = new Camera()
    }
  }

  render(renderer) {
    renderer.setRenderTarget(this.#fbo)
    this.#onBeforeRender && this.#onBeforeRender(this)
    renderer.render(this.scene, this.#camera)
    this.#onAfterRender && this.#onAfterRender(this)
    renderer.setRenderTarget(null)
    return this
  }
}
