import { useCallback, useEffect, useState } from 'react'

export type Direction = 'ltr' | 'rtl'

const KEY = 'sf-dir'

function readStored(): Direction {
  return localStorage.getItem(KEY) === 'rtl' ? 'rtl' : 'ltr'
}

/**
 * Writing direction, as a real toggle rather than a claim.
 *
 * RTL is easy to say and hard to mean. The only way to know whether a layout
 * survives it is to flip it and look, so this exists to make that one click,
 * mirroring how `useTheme` handles light and dark.
 *
 * It sets `dir` on `<html>`, which is what CSS logical properties key off. The
 * layout does the rest: `inset-inline-start` instead of `left`, `margin-inline`
 * instead of `margin-left`, `text-align: start` instead of `left`. Anything
 * still written in physical directions is exactly what the toggle exposes.
 *
 * What this is not: translation. The interface is in English in both
 * directions, because pretending to ship Arabic copy would be a lie in a
 * portfolio. What is demonstrated is that the layout is direction-agnostic.
 */
export function useDirection() {
  const [direction, setDirectionState] = useState<Direction>(readStored)

  useEffect(() => {
    document.documentElement.setAttribute('dir', direction)
  }, [direction])

  const setDirection = useCallback((next: Direction) => {
    localStorage.setItem(KEY, next)
    setDirectionState(next)
  }, [])

  const toggle = useCallback(() => {
    setDirection(readStored() === 'rtl' ? 'ltr' : 'rtl')
  }, [setDirection])

  return { direction, setDirection, toggle }
}
