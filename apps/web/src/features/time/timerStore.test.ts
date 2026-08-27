import type { TimeEntry } from '@studioflow/contracts'
import { autorun } from 'mobx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDuration, TimerStore } from './timerStore'

/**
 * The timer module, tested as what it is: a plain object with a clock. No DOM,
 * no store provider, no network. That is most of the argument for keeping this
 * state out of Redux in the first place.
 */

const START = new Date('2026-08-17T09:00:00.000Z')

const runningEntry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'te_001',
  projectId: 'pr_001',
  projectName: 'Website relaunch',
  clientName: 'Ava Thompson',
  description: 'Wireframes',
  startedAt: START.toISOString(),
  endedAt: null,
  createdAt: START.toISOString(),
  ...over,
})

let store: TimerStore

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
  store = new TimerStore()
})

afterEach(() => {
  store.dispose()
  vi.useRealTimers()
})

describe('TimerStore', () => {
  it('starts idle', () => {
    expect(store.isRunning).toBe(false)
    expect(store.elapsedSeconds).toBe(0)
    expect(store.projectName).toBe('')
  })

  it('counts up once a second while an entry is running', () => {
    store.adopt(runningEntry())
    expect(store.isRunning).toBe(true)
    expect(store.elapsedSeconds).toBe(0)

    vi.advanceTimersByTime(1000)
    expect(store.elapsedSeconds).toBe(1)

    vi.advanceTimersByTime(59_000)
    expect(store.elapsedSeconds).toBe(60)
  })

  it('derives the elapsed time rather than accumulating it', () => {
    // Adopting an entry that started ten minutes ago shows ten minutes, with
    // no ticks having happened. An accumulator would show zero.
    store.adopt(
      runningEntry({
        startedAt: new Date(START.getTime() - 10 * 60_000).toISOString(),
      }),
    )
    expect(store.elapsedSeconds).toBe(600)
  })

  it('notifies observers on each tick, and only while running', () => {
    const seen: number[] = []
    const stop = autorun(() => seen.push(store.elapsedSeconds))
    expect(seen).toEqual([0])

    store.adopt(runningEntry())
    vi.advanceTimersByTime(3000)
    // Note what is absent: adopting the entry did not produce a second zero.
    // A computed that recomputes to the same value notifies nobody, which is
    // the whole efficiency argument for keeping the tick here.
    expect(seen).toEqual([0, 1, 2, 3])

    store.adopt(null)
    const afterStop = seen.length
    vi.advanceTimersByTime(5000)
    // Nothing ticks once the timer is gone, so nothing re-renders.
    expect(seen.length).toBe(afterStop)
    stop()
  })

  it('stops the interval when the timer stops', () => {
    const clear = vi.spyOn(globalThis, 'clearInterval')
    store.adopt(runningEntry())
    store.adopt(null)

    expect(clear).toHaveBeenCalled()
    expect(store.isRunning).toBe(false)
    expect(store.elapsedSeconds).toBe(0)
  })

  it('does not start a second interval when adopting twice', () => {
    const set = vi.spyOn(globalThis, 'setInterval')
    store.adopt(runningEntry())
    store.adopt(runningEntry({ description: 'Renamed' }))

    // Two intervals would count double and never be cleared.
    expect(set).toHaveBeenCalledTimes(1)
  })

  it('carries the description in, and lets it be edited locally', () => {
    store.adopt(runningEntry({ description: 'Wireframes' }))
    expect(store.draftDescription).toBe('Wireframes')

    store.setDraftDescription('Wireframes, round two')
    expect(store.draftDescription).toBe('Wireframes, round two')
    // The entry itself is untouched: the server owns that until it is saved.
    expect(store.running?.description).toBe('Wireframes')
  })

  it('exposes the project it is timing against', () => {
    store.adopt(runningEntry())
    expect(store.projectName).toBe('Website relaunch')
  })

  it('is silent after disposal', () => {
    store.adopt(runningEntry())
    store.dispose()
    const before = store.elapsedSeconds
    vi.advanceTimersByTime(10_000)
    expect(store.elapsedSeconds).toBe(before)
  })
})

describe('formatDuration', () => {
  it('shows minutes and seconds, and hours only once there are any', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(9)).toBe('00:09')
    expect(formatDuration(75)).toBe('01:15')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3661)).toBe('1:01:01')
  })

  it('never renders a negative clock', () => {
    expect(formatDuration(-5)).toBe('00:00')
  })
})
