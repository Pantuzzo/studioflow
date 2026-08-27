import { describe, expect, it } from 'vitest'
import {
  createTimeEntrySchema,
  entryDurationSeconds,
  isRunning,
  startTimerSchema,
  timeEntrySchema,
  updateTimeEntrySchema,
} from './index'

const ENTRY = {
  id: 'te_001',
  projectId: 'pr_001',
  projectName: 'Website relaunch',
  clientName: 'Ava Thompson',
  description: 'Wireframes',
  startedAt: '2026-08-17T09:00:00.000Z',
  endedAt: '2026-08-17T10:30:00.000Z',
  createdAt: '2026-08-17T09:00:00.000Z',
}

describe('timeEntrySchema', () => {
  it('accepts a finished entry and a running one', () => {
    expect(timeEntrySchema.safeParse(ENTRY).success).toBe(true)
    expect(timeEntrySchema.safeParse({ ...ENTRY, endedAt: null }).success).toBe(
      true,
    )
  })

  it('carries no duration field, because duration is derived', () => {
    const parsed = timeEntrySchema.parse({ ...ENTRY, durationSeconds: 9999 })
    expect(parsed).not.toHaveProperty('durationSeconds')
  })
})

describe('entryDurationSeconds', () => {
  it('measures a finished entry from its own timestamps', () => {
    expect(entryDurationSeconds(ENTRY)).toBe(90 * 60)
  })

  it('measures a running entry against the clock it is given', () => {
    const now = new Date('2026-08-17T09:00:30.000Z').getTime()
    expect(entryDurationSeconds({ ...ENTRY, endedAt: null }, now)).toBe(30)
  })

  it('never returns a negative duration', () => {
    // A clock that jumped backwards should read zero, not a negative bill.
    const now = new Date('2026-08-17T08:00:00.000Z').getTime()
    expect(entryDurationSeconds({ ...ENTRY, endedAt: null }, now)).toBe(0)
  })

  it('knows a running entry from a finished one', () => {
    expect(isRunning({ endedAt: null })).toBe(true)
    expect(isRunning(ENTRY)).toBe(false)
  })
})

describe('startTimerSchema', () => {
  it('takes no timestamps, so the server clock decides', () => {
    const parsed = startTimerSchema.parse({
      projectId: 'pr_001',
      startedAt: '1999-01-01T00:00:00.000Z',
    })
    expect(parsed).toEqual({ projectId: 'pr_001', description: '' })
  })

  it('requires a project', () => {
    const result = startTimerSchema.safeParse({ projectId: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Choose a project')
  })
})

describe('createTimeEntrySchema', () => {
  const base = {
    projectId: 'pr_001',
    startedAt: '2026-08-17T09:00:00.000Z',
    endedAt: '2026-08-17T10:00:00.000Z',
  }

  it('accepts a completed entry typed in by hand', () => {
    expect(createTimeEntrySchema.safeParse(base).success).toBe(true)
  })

  it('refuses an interval that ends before it starts', () => {
    const result = createTimeEntrySchema.safeParse({
      ...base,
      endedAt: '2026-08-17T08:00:00.000Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'The end has to come after the start',
    )
  })

  it('refuses a zero-length entry', () => {
    expect(
      createTimeEntrySchema.safeParse({ ...base, endedAt: base.startedAt })
        .success,
    ).toBe(false)
  })

  it('caps an entry at a day', () => {
    const result = createTimeEntrySchema.safeParse({
      ...base,
      endedAt: '2026-08-19T09:00:00.000Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(
      'An entry cannot be longer than a day',
    )
  })
})

describe('updateTimeEntrySchema', () => {
  it('accepts a single field', () => {
    expect(updateTimeEntrySchema.safeParse({ description: 'x' }).success).toBe(
      true,
    )
  })

  it('rejects an empty patch', () => {
    expect(updateTimeEntrySchema.safeParse({}).success).toBe(false)
  })

  it('checks the two timestamps together when both are sent', () => {
    expect(
      updateTimeEntrySchema.safeParse({
        startedAt: '2026-08-17T10:00:00.000Z',
        endedAt: '2026-08-17T09:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('allows stopping a timer by sending an end on its own', () => {
    expect(
      updateTimeEntrySchema.safeParse({ endedAt: '2026-08-17T10:00:00.000Z' })
        .success,
    ).toBe(true)
  })
})
