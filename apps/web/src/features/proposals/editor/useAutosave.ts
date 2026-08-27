import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface Autosave {
  status: SaveStatus
  /** Save now, without waiting out the debounce. */
  retry: () => void
}

/**
 * Save `value` a beat after it stops changing.
 *
 * Four things make autosave trustworthy rather than merely present:
 *
 * - **It debounces.** A burst of keystrokes is one request, not thirty.
 * - **It compares by content, not identity.** Loading a document produces a new
 *   object holding the same thing, and that must not count as an edit; undoing
 *   back to where you started must not either.
 * - **It flushes on unmount.** Navigating away mid-debounce is exactly when a
 *   naive implementation loses the last edit. It cannot be awaited there, which
 *   is a real limit — a closing tab can still outrun it.
 * - **It says so.** Failure is a state the UI shows and can retry, never a
 *   silent loss dressed up as "Saved".
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  options: { delay?: number; enabled?: boolean } = {},
): Autosave {
  const { delay = 800, enabled = true } = options

  const [status, setStatus] = useState<SaveStatus>('idle')

  const serialize = (input: T) => JSON.stringify(input)

  /** Serialised form of what the server is known to hold. */
  const savedRef = useRef(serialize(value))
  /** Edited but not yet accepted by the server. */
  const pendingRef = useRef<T | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save
  const aliveRef = useRef(true)

  const run = useCallback(async () => {
    const next = pendingRef.current
    if (next === null) return
    const attempted = JSON.stringify(next)
    setStatus('saving')
    try {
      await saveRef.current(next)
      savedRef.current = attempted
      // An edit may have landed while the request was in flight; only clear the
      // pending value if it is still the one that was just saved.
      const stillPending =
        pendingRef.current !== null &&
        JSON.stringify(pendingRef.current) !== attempted
      if (!stillPending) pendingRef.current = null
      if (aliveRef.current) setStatus(stillPending ? 'saving' : 'saved')
    } catch {
      if (aliveRef.current) setStatus('error')
    }
  }, [])

  useEffect(() => {
    // Before the document has loaded there is nothing to save, and whatever is
    // on screen is by definition what the server holds.
    if (!enabled) {
      savedRef.current = serialize(value)
      return
    }

    const next = serialize(value)
    if (next === savedRef.current) return

    pendingRef.current = value
    setStatus('saving')
    const timer = setTimeout(() => void run(), delay)
    // Cleared on every change — which is what makes this a debounce rather than
    // a queue of requests.
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay, enabled, run])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      // Fire and forget: unmount cannot wait on a promise. It is the difference
      // between usually losing the last edit and rarely losing it.
      if (pendingRef.current !== null) void saveRef.current(pendingRef.current)
    }
  }, [])

  const retry = useCallback(() => void run(), [run])

  return { status, retry }
}
