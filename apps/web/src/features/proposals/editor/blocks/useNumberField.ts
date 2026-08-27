import { useEffect, useRef, useState } from 'react'

/**
 * A numeric input that the user types into freely while the document stores a
 * number.
 *
 * Rendering `format(value)` on every keystroke is the obvious approach and the
 * wrong one: typing "9" would commit 900 and immediately rewrite the field as
 * "9.00", moving the caret. So the draft string is the source of truth while
 * editing, and it is only overwritten when the value changes for a reason this
 * field did not cause — an undo, or a document reloading underneath it.
 *
 * Text that does not parse is left alone rather than reverted, because a field
 * that erases what you typed the moment it is momentarily invalid is worse than
 * one that waits.
 */
export function useNumberField(
  value: number,
  format: (value: number) => string,
  parse: (text: string) => number | null,
  commit: (value: number) => void,
) {
  const [draft, setDraft] = useState(() => format(value))
  const ours = useRef(value)

  useEffect(() => {
    if (value !== ours.current) {
      ours.current = value
      setDraft(format(value))
    }
  }, [value, format])

  function onChange(text: string) {
    setDraft(text)
    const parsed = parse(text)
    if (parsed === null) return
    ours.current = parsed
    commit(parsed)
  }

  return { value: draft, onChange }
}
