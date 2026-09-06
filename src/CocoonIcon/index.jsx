import { cloneElement, isValidElement } from 'react'
import { icons, iconNames } from './icons.js'

/**
 * A cocoon icon at text size, in text colour.
 *
 * The two defaults are the point: size is the font size and colour is
 * inherited, so an icon dropped beside a word matches that word without
 * being told anything. The files make that work: square viewBox, no margin,
 * every fill currentColor. Built from CocoonIcon.spec.md.
 *
 * @param {object} props
 * @param {string} [props.name] one of iconNames; omit when passing an <svg> child
 * @param {import('react').ReactNode} [props.children] an inline <svg>, used when name is absent
 * @param {number|string} [props.size] px as a number, or any CSS length; omitted means 1em
 * @param {string} [props.color] any CSS colour; omitted means inherit
 * @param {string} [props.title] accessible name; omitted marks the icon decorative
 * @param {object} [props.style] merged last onto the wrapper
 */
export function CocoonIcon({
  name,
  children,
  size,
  color,
  title,
  style,
  ...rest
}) {
  // Object.hasOwn, not icons[name]: a plain lookup resolves inherited names
  // such as constructor and toString, and hands React something to render.
  const Art = name != null && Object.hasOwn(icons, name) ? icons[name] : null
  if (name != null && Art == null)
    throw new Error(
      `CocoonIcon: no icon named "${name}". Available: ${iconNames.join(', ')}`,
    )
  if (Art == null && children == null)
    throw new Error('CocoonIcon: pass either a `name` or an <svg> child.')

  const box =
    size == null ? '1em' : typeof size === 'number' ? `${size}px` : size
  const wrapper = {
    display: 'inline-flex',
    width: box,
    height: box,
    flex: 'none',
    lineHeight: 1,
    // The optical centre of the text rather than its baseline, as icon fonts sit.
    verticalAlign: '-0.125em',
    ...(color == null ? null : { color }),
    ...style,
  }
  // The artwork fills the box exactly: the files have no margin of their own.
  const fill = { width: '100%', height: '100%', display: 'block' }
  const art = Art ? (
    <Art style={fill} />
  ) : isValidElement(children) ? (
    cloneElement(children, { style: { ...fill, ...children.props.style } })
  ) : (
    children
  )
  return (
    <span
      style={wrapper}
      {...(title == null
        ? { 'aria-hidden': 'true' }
        : { role: 'img', 'aria-label': title })}
      {...rest}
    >
      {art}
    </span>
  )
}

export { icons, iconNames }
