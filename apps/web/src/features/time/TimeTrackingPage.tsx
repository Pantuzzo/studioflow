import { useEffect, useRef, useState, type ReactNode } from 'react'
import { entryDurationSeconds, type TimeEntry } from '@studioflow/contracts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from './TimeTrackingPage.module.css'
import { TimerBar } from './TimerBar'
import {
  useDeleteTimeEntryMutation,
  useGetRunningEntryQuery,
  useGetTimeEntriesQuery,
} from './timeEntriesApi'
import { formatDuration, TimerStore } from './timerStore'

/** Rows are a fixed height, which is what makes them cheap to place. */
const ROW_HEIGHT = 56

function timeOfDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function dayOf(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(iso),
  )
}

export function TimeTrackingPage() {
  // One store per mount, disposed with the page: nothing should tick on a
  // screen nobody is looking at.
  const [store] = useState(() => new TimerStore())
  useEffect(() => () => store.dispose(), [store])

  const { data: running } = useGetRunningEntryQuery()
  const {
    data: entries,
    isLoading,
    isError,
    refetch,
  } = useGetTimeEntriesQuery()

  // The server is the authority on what is running; the store only points the
  // clock at it. This is the seam described in README.md.
  useEffect(() => {
    if (running !== undefined) store.adopt(running)
  }, [running, store])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Time</h1>
          <p className={styles.subtitle}>
            What you worked on, and for how long.
          </p>
        </div>
      </header>

      <TimerBar store={store} />

      <EntryList
        entries={entries}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
      />
    </div>
  )
}

function EntryList({
  entries,
  isLoading,
  isError,
  onRetry,
}: {
  entries: TimeEntry[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [deleteEntry] = useDeleteTimeEntryMutation()
  const { toast } = useToast()

  // Finished entries only: the running one lives in the bar above, and showing
  // it twice would mean two clocks that can disagree.
  const finished = (entries ?? []).filter((entry) => entry.endedAt !== null)

  const virtualizer = useVirtualizer({
    count: finished.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  async function remove(entry: TimeEntry) {
    try {
      await deleteEntry(entry.id).unwrap()
    } catch {
      toast({
        title: 'We couldn’t delete that entry',
        description: 'It’s still on your timesheet.',
        variant: 'error',
      })
    }
  }

  let content: ReactNode = null
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading your timesheet…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your timesheet.</p>
        <Button variant="soft" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  } else if (finished.length === 0) {
    content = <p className={styles.state}>Nothing tracked yet.</p>
  }

  if (content) return content

  const total = finished.reduce(
    (sum, entry) => sum + entryDurationSeconds(entry),
    0,
  )

  return (
    <section className={styles.timesheet} aria-label="Timesheet">
      <p className={styles.total}>
        {finished.length} entries · {formatDuration(total)} tracked
      </p>

      {/*
        A timesheet grows without bound, so only the rows in view are in the
        DOM. The list keeps its full height, so the scrollbar stays honest.
      */}
      <div ref={scrollRef} className={styles.scroller}>
        <ul
          className={styles.rows}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const entry = finished[virtualRow.index]
            if (!entry) return null
            return (
              <li
                key={entry.id}
                className={styles.row}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className={styles.rowText}>
                  <p className={styles.rowTitle}>
                    {entry.description || 'No description'}
                  </p>
                  <p className={styles.rowMeta}>
                    {entry.projectName} · {entry.clientName} ·{' '}
                    {dayOf(entry.startedAt)} at {timeOfDay(entry.startedAt)}
                  </p>
                </div>
                <span className={styles.rowDuration}>
                  {formatDuration(entryDurationSeconds(entry))}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete ${entry.description || 'entry'}`}
                  onClick={() => void remove(entry)}
                >
                  Delete
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
