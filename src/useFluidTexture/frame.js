export class FrameSplitter {
  #n
  #callback
  #idleFramesSinceInvocation = 0
  constructor(callback, n) {
    this.#n = n
    this.#callback = callback
  }
  set(callback, n) {
    if (typeof callback !== 'undefined') {
      this.#callback = callback
    }
    if (typeof n !== 'undefined') {
      this.#n = n
    }
    this.#idleFramesSinceInvocation = 0
  }
  frame(...args) {
    // increment frame counter; if pre-increment value is 0, run callback
    if (this.#idleFramesSinceInvocation++ === 0) {
      if (this.#callback) {
        this.#callback(...args)
      }
    }
    // if post-increment value is equal to n, set frame counter to 0
    if (this.#idleFramesSinceInvocation >= this.#n) {
      this.#idleFramesSinceInvocation = 0
    }
  }
}
