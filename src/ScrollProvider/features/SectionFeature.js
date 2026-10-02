export class SectionFeature {
  #sectionContainer
  #scrollHeight
  #clientHeight
  #sectionData
  #scrollDistance
  #scrollTop
  #activeSectionIndex = 0
  #activeSectionOffset = 0.0

  constructor(...args) {
    this.update(...args)
  }

  /**
   * calculates section scroll data
   *
   * @param {HTMLElement} sectionContainer direct parent of static sections
   * @param {number} scrollHeight scroll element's scroll height
   * @param {number} clientHeight scroll element's client height
   * @returns {Array<object>} array of {min, max} scroll values for each section
   *
   */
  static getSectionData(sectionContainer, scrollHeight, clientHeight) {
    if (
      !(sectionContainer instanceof HTMLElement) ||
      typeof scrollHeight !== 'number' ||
      scrollHeight <= 0 ||
      typeof clientHeight !== 'number' ||
      clientHeight <= 0
    ) {
      return
    }

    const sectionData = []
    let _min = 0
    let belowTheFold = false
    for (const child of sectionContainer.children[0].children) {
      let max = _min + child.clientHeight
      if (!belowTheFold && max >= clientHeight) {
        belowTheFold = true
        max = max - clientHeight
      }

      max = belowTheFold ? max : 0
      const min = _min
      const computeSectionOffset =
        max > 0
          ? (scrollTop) =>
              Math.min(Math.max(scrollTop - min, 0.0) / (max - min), 1.0)
          : () => 1.0

      sectionData.push({
        min,
        max,
        computeSectionOffset,
      })

      _min = max

      if (max > scrollHeight) {
        throw Error(
          "Cumulative section clientHeights exceed the container's clientHeight.Sections should be statically positioned with no margin or border.",
        )
      }
    }
    return sectionData
  }

  update(sectionContainer, scrollHeight, clientHeight, scrollTop = 0) {
    if (sectionContainer) {
      this.#sectionContainer = sectionContainer
      this.#scrollHeight = scrollHeight
      this.#clientHeight = clientHeight
      // derived data
      this.#scrollDistance = this.#scrollHeight - this.#clientHeight
      this.#sectionData = SectionFeature.getSectionData(
        sectionContainer,
        scrollHeight,
        clientHeight,
      )
      this.setScrollTop(scrollTop)
    }

    return this
  }

  get inputs() {
    return {
      sectionContainer: this.#sectionContainer,
      scrollHeight: this.#scrollHeight,
      clientHeight: this.#clientHeight,
    }
  }

  set sectionContainer(el) {
    this.#sectionContainer = el
    this.#sectionData = SectionFeature.getSectionData(
      this.#sectionContainer,
      this.#scrollHeight,
      this.#clientHeight,
    )
    this.setScrollTop(this.#scrollTop)
  }

  set scrollHeight(val) {
    this.#scrollHeight = val
    this.#scrollDistance = this.#scrollHeight - this.#clientHeight
    this.#sectionData = SectionFeature.getSectionData(
      this.#sectionContainer,
      this.#scrollHeight,
      this.#clientHeight,
    )
    this.setScrollTop(this.#scrollTop)
  }

  set clientHeight(val) {
    this.#clientHeight = val
    this.#scrollDistance = this.#scrollHeight - this.#clientHeight
    this.#sectionData = SectionFeature.getSectionData(
      this.#sectionContainer,
      this.#scrollHeight,
      this.#clientHeight,
    )
    this.setScrollTop(this.#scrollTop)
  }

  get scrollTop() {
    return this.#scrollTop
  }

  set scrollTop(val) {
    this.setScrollTop(val)
  }

  /**
   * calculates the active section index and the scroll offset [0,1] within the section
   *
   * @param {number} val current scroll element's scrollTop
   * @param {function | undefined} onSectionChange callback to run once when the active section changes: (activeSectionIndex: number, activeSectionOffset: number) => void. Only runs once per change so React state changes are safe here.
   * @returns {SectionFeature} the instance
   *
   */
  setScrollTop(val, onSectionChange = () => {}) {
    this.#scrollTop = val

    const oldIndex = this.#activeSectionIndex
    // compute active props
    if (
      (this.#activeSectionIndex = this.#sectionData.findIndex(
        ({ min, max }) => this.#scrollTop >= min && this.#scrollTop <= max,
      )) < 0
    ) {
      throw Error('setScrollTop: value provided is outside section range')
    }

    this.#activeSectionOffset = this.#sectionData[
      this.#activeSectionIndex
    ].computeSectionOffset(this.#scrollTop)

    if (oldIndex !== this.#activeSectionIndex) {
      onSectionChange(this.#activeSectionIndex, this.#activeSectionOffset)
    }
    return this
  }

  get scrollDistance() {
    return this.#scrollDistance
  }
  get sectionData() {
    return { ...this.#sectionData }
  }

  get activeSectionIndex() {
    return this.#activeSectionIndex
  }

  get activeSectionOffset() {
    return this.#activeSectionOffset
  }

  get data() {
    return {
      sectionData: { ...this.#sectionData },
      scrollDistance: this.#scrollDistance,
      scrollTop: this.#scrollTop,
      activeSectionIndex: this.#activeSectionIndex,
      activeSectionOffset: this.#activeSectionOffset,
      ...this.inputs,
    }
  }
}
