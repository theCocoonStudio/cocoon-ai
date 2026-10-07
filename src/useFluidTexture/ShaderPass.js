import { Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three/webgpu'

/**
 * One pass of the simulation: a material on a quad (or a given geometry),
 * rendered through a camera into a render target. The material is a TSL node
 * material built by `tsl/passes.js`; its inputs, the uniform and texture nodes
 * it reads, are kept here so the hook can repoint a texture per step
 * (`updateUniforms({ velocity: { value: texture } })`) without touching the
 * material.
 *
 * `clear` is whether the renderer may clear the target before this pass. The
 * two force passes add into the velocity advection just wrote, so they render
 * with autoClear off and restore it; with it on, the renderer clears the
 * target first and the advected velocity is lost (the 2D hook did exactly
 * that until the port of 2026-10-06, measured in the browser test). The toggle
 * is synchronous and local: read, set, render into our own target, restore;
 * nothing else runs between. `render(renderer, false)` leaves the renderer's
 * options alone for a consumer who manages them itself.
 */
export class ShaderPass {
  #fbo
  #children
  #onDispose
  #inputs = {}
  #geometry
  #mesh
  #camera
  #clear
  constructor({
    material,
    inputs = {},
    geometry,
    camera,
    fbo = null,
    children,
    onDispose,
    clear = true,
  }) {
    this.material = material
    this.#inputs = inputs
    this.#clear = clear
    if (geometry) {
      this.#geometry = typeof geometry === 'function' ? geometry() : geometry
    } else if (geometry !== null) {
      this.#geometry = new PlaneGeometry(2.0, 2.0)
    }
    this.#mesh = new Mesh(this.#geometry, this.material)
    this.updateCamera(camera)
    this.scene = new Scene()
    this.scene.add(this.#mesh)
    if (children) {
      this.#children =
        typeof children === 'function' ? children(this) : children
      this.scene.add(this.#children)
    }
    this.#fbo = fbo
    this.#onDispose = onDispose
  }

  dispose(material = true, geometry = true, fbo = true, onDispose = true) {
    material && this.material.dispose()
    geometry && this.#geometry?.dispose()
    fbo && this.#fbo?.dispose()
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

  /** The pass's input nodes by name: uniform nodes and texture nodes. */
  get uniforms() {
    return this.#inputs
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

  /**
   * Repoint inputs: `{ name: { value } }` sets the node's value. A texture node
   * takes a new texture (the ping-pong); a uniform node takes a new number or
   * vector. Unknown names are ignored, so a pass may be given the whole table.
   */
  updateUniforms(values = {}) {
    for (const name in values) {
      const node = this.#inputs[name]
      if (node) node.value = values[name].value
    }
    return this
  }

  updateCamera(newCamera) {
    if (newCamera) {
      this.#camera = typeof newCamera === 'function' ? newCamera() : newCamera
    } else if (newCamera !== null) {
      this.#camera = new OrthographicCamera(-1, 1, 1, -1, -1, 1)
    }
  }

  render(renderer, setRendererOptions = true) {
    const toggle = !this.#clear && setRendererOptions
    const autoClear = renderer.autoClear
    if (toggle) renderer.autoClear = false
    renderer.setRenderTarget(this.#fbo)
    renderer.render(this.scene, this.#camera)
    renderer.setRenderTarget(null)
    if (toggle) renderer.autoClear = autoClear
    return this
  }
}
