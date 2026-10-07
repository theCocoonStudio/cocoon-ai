import { useCallback, useMemo, useState } from 'react'

const KINDS = new Set(['number', 'boolean', 'select', 'colour', 'vector'])

/**
 * @typedef {object} SettingEntry
 * @property {'number'|'boolean'|'select'|'colour'|'vector'} kind
 * @property {*} default the initial value; a number, boolean, string (select, colour) or array (vector)
 * @property {string} [label] shown beside the control; the key when absent
 * @property {number} [min] number only
 * @property {number} [max] number only
 * @property {number} [step] number and vector
 * @property {Array<string|{value: string, label: string}>} [options] select only
 * @property {string[]} [components] vector only; the component names, default x, y, z
 * @property {boolean} [live=true] false when a change must remount the scene; the hook's `key` changes with it
 * @property {{key: string, value: *}} [when] shown only while values[key] === value
 * @property {string} [group] the fieldset the control sits in
 */

/** Throws, naming the key, when an entry cannot be rendered or has no usable default (exits.throws). */
function validate(schema) {
  if (!schema || typeof schema !== 'object') {
    throw new Error(
      'useSettings: the schema must be an object keyed by setting',
    )
  }
  for (const [key, entry] of Object.entries(schema)) {
    const at = `useSettings: "${key}"`
    if (!entry || !KINDS.has(entry.kind)) {
      throw new Error(
        `${at} has no kind, or an unknown one; kinds are number, boolean, select, colour, vector`,
      )
    }
    if (entry.kind === 'number' && typeof entry.default !== 'number') {
      throw new Error(`${at} is a number with no numeric default`)
    }
    if (
      entry.kind === 'select' &&
      !(Array.isArray(entry.options) && entry.options.length > 0)
    ) {
      throw new Error(`${at} is a select with no options`)
    }
    if (entry.kind === 'vector' && !Array.isArray(entry.default)) {
      throw new Error(`${at} is a vector whose default is not an array`)
    }
  }
}

const defaultsOf = (schema) =>
  Object.fromEntries(
    Object.entries(schema).map(([key, entry]) => [
      key,
      Array.isArray(entry.default) ? [...entry.default] : entry.default,
    ]),
  )

/** The remount key: the values of every entry with `live: false`, serialised. */
const remountKey = (schema, values) =>
  JSON.stringify(
    Object.entries(schema)
      .filter(([, entry]) => entry.live === false)
      .map(([key]) => values[key]),
  )

/**
 * The settings of a demo: validates the schema once, holds the values, and
 * returns what `Demo` renders and a scene reads. `key` changes only when an
 * entry with `live: false` changes, so a scene keyed by it remounts for those
 * and updates in place for the rest. The schema must be referentially stable
 * (a module constant), or it is validated again each render.
 *
 * @param {Record<string, SettingEntry>} schema
 * @returns {{ schema: Record<string, SettingEntry>, values: Record<string, *>, set: (key: string, value: *) => void, reset: () => void, key: string }}
 */
export function useSettings(schema) {
  const defaults = useMemo(() => {
    validate(schema)
    return defaultsOf(schema)
  }, [schema])
  const [values, setValues] = useState(defaults)
  const set = useCallback(
    (key, value) => setValues((prev) => ({ ...prev, [key]: value })),
    [],
  )
  const reset = useCallback(() => setValues(defaultsOf(schema)), [schema])
  const key = useMemo(() => remountKey(schema, values), [schema, values])
  return useMemo(
    () => ({ schema, values, set, reset, key }),
    [schema, values, set, reset, key],
  )
}
