import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutosave } from './useAutosave'

/**
 * Let queued promises settle. `waitFor` cannot be used here: it polls on
 * timers, and the timers are fake, so it would wait for a clock nobody is
 * winding.
 */
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0))

interface Doc {
  title: string
  blocks: string[]
}

const DELAY = 100

function setup(
  save: (value: Doc) => Promise<unknown>,
  initial: Doc,
  enabled = true,
) {
  return renderHook(
    ({ value }: { value: Doc }) =>
      useAutosave(value, save, { delay: DELAY, enabled }),
    { initialProps: { value: initial } },
  )
}

const doc = (title: string, blocks: string[] = []): Doc => ({ title, blocks })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutosave', () => {
  it('collapses a burst of edits into a single save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = setup(save, doc('a'))

    rerender({ value: doc('ab') })
    rerender({ value: doc('abc') })
    rerender({ value: doc('abcd') })
    expect(save).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(DELAY))

    // One request, carrying the last value — not four requests racing.
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(doc('abcd'))
  })

  it('says nothing has changed when the content is equal', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = setup(save, doc('a', ['b1']))

    // A new object holding the same document — what loading produces.
    rerender({ value: doc('a', ['b1']) })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))

    expect(save).not.toHaveBeenCalled()
  })

  it('does not save an edit that is undone back to where it started', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = setup(save, doc('a'))

    rerender({ value: doc('ab') })
    rerender({ value: doc('a') })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))

    expect(save).not.toHaveBeenCalled()
  })

  it('moves through saving to saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = setup(save, doc('a'))
    expect(result.current.status).toBe('idle')

    rerender({ value: doc('ab') })
    // The status flips as soon as there is something unsaved, not when the
    // request leaves — otherwise it reads "saved" while an edit is pending.
    expect(result.current.status).toBe('saving')

    await act(() => vi.advanceTimersByTimeAsync(DELAY))
    await flush()
    expect(result.current.status).toBe('saved')
  })

  it('reports a failure and can retry it', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const { result, rerender } = setup(save, doc('a'))

    rerender({ value: doc('ab') })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))
    await flush()
    expect(result.current.status).toBe('error')

    // The unsaved document is still held, so retrying sends the same thing.
    act(() => result.current.retry())
    await flush()
    expect(result.current.status).toBe('saved')
    expect(save).toHaveBeenLastCalledWith(doc('ab'))
  })

  it('flushes a pending edit when the component goes away', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = setup(save, doc('a'))

    rerender({ value: doc('ab') })
    // Still inside the debounce window: a naive implementation loses this.
    expect(save).not.toHaveBeenCalled()

    unmount()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(doc('ab'))
  })

  it('has nothing to flush once everything is saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender, unmount } = setup(save, doc('a'))

    rerender({ value: doc('ab') })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))
    expect(save).toHaveBeenCalledTimes(1)

    unmount()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('stays quiet while disabled, and treats what loads as already saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook(
      ({ value, enabled }: { value: Doc; enabled: boolean }) =>
        useAutosave(value, save, { delay: DELAY, enabled }),
      { initialProps: { value: doc(''), enabled: false } },
    )

    // The document arrives from the server, then the editor switches on.
    rerender({ value: doc('loaded', ['b1']), enabled: false })
    rerender({ value: doc('loaded', ['b1']), enabled: true })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))

    // Loading is not an edit.
    expect(save).not.toHaveBeenCalled()

    rerender({ value: doc('loaded!', ['b1']), enabled: true })
    await act(() => vi.advanceTimersByTimeAsync(DELAY))
    expect(save).toHaveBeenCalledTimes(1)
  })
})
