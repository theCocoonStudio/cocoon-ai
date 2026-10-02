export class AnimationFeature {
  #min
  #max
  #scrollTop
  #activeOffset

  constructor(...args) {
    this.update(...args)
  }

  /**
   * calculates an offset given a current scrollTop, a min, and a max
   *
   * @param {number} scrollTop current scrollTop
   * @param {number} min desired range minimum
   * @param {number} max desired range maximum
   * @returns {number} a normalized offset
   *
   */
  static getOffset(scrollTop, min, max) {
    return (scrollTop - min) / (max - min)
  }

  /**
   * calculates an offset clamped at [0, 1] given a current scrollTop, a min, and a max
   *
   * @param {number} scrollTop current scrollTop
   * @param {number} min desired range minimum
   * @param {number} max desired range maximum
   * @returns {number} a normalized offset clamped at [0, 1]
   *
   */
  static getClampedOffset(scrollTop, min, max) {
    return Math.min(Math.max(scrollTop - min, 0.0) / (max - min), 1.0)
  }

  update(min, max, scrollTop = 0) {
    this.#min = min
    this.#max = max
    if (this.#min >= this.#max) {
      throw Error(
        "AnimationFeature: supplied min value must be smaller than the instance's max",
      )
    }
    this.setScrollTop(scrollTop)

    return this
  }
  get min() {
    return this.#min
  }
  get max() {
    return this.#max
  }
  get scrollTop() {
    return this.#scrollTop
  }
  get activeOffset() {
    return this.#activeOffset
  }
  set min(val) {
    this.#min = val
    if (this.#min >= this.#max) {
      throw Error(
        "AnimationFeature: supplied min value must be smaller than the instance's max",
      )
    }
    this.setScrollTop(this.#scrollTop)
  }
  set max(val) {
    this.#max = val
    if (this.#min >= this.#max) {
      throw Error(
        "AnimationFeature: supplied min value must be smaller than the instance's max",
      )
    }
    this.setScrollTop(this.#scrollTop)
  }
  set scrollTop(val) {
    this.setScrollTop(val)
  }

  /**
   * calculates and sets the active, non-clamped offset offset
   *
   * @param {number} val current scroll element's scrollTop
   * @returns {AnimationFeature} the instance
   *
   */
  setScrollTop(val) {
    this.#activeOffset = AnimationFeature.getOffset(val, this.#min, this.#max)
    return this
  }
}
