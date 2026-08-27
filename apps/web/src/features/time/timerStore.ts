import { entryDurationSeconds, type TimeEntry } from '@studioflow/contracts'
import { makeAutoObservable, runInAction } from 'mobx'

/**
 * The running timer.
 *
 * This is the module [ADR 0003](../../../../docs/adr/0003-redux-toolkit-plus-mobx.md)
 * reserved MobX for, and the reason is one field: `now`. A running timer
 * changes once a second, forever, and nothing outside this module cares about
 * those changes. Pushing them through the Redux store would mean an action, a
 * reducer pass and a subscription notification every second, so that one label
 * can count.
 *
 * The boundary is deliberate and narrow:
 *
 * - RTK Query owns the entries the server knows about. Starting and stopping
 *   are ordinary mutations; this store never calls the network.
 * - This store owns what only the browser knows: which entry is running right
 *   now, what second it is, and the description being typed before it is saved.
 *
 * The seam is `adopt`, which is the only way server state enters here.
 */
export class TimerStore {
  /** The running entry as the server last described it, or nothing. */
  running: TimeEntry | null = null

  /** The current second. Observable on purpose; see the note above. */
  now = Date.now()

  /** Typed while the timer runs, sent when it stops. */
  draftDescription = ''

  private ticker: ReturnType<typeof setInterval> | null = null

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get isRunning(): boolean {
    return this.running !== null
  }

  /** Seconds on the clock, derived rather than accumulated. */
  get elapsedSeconds(): number {
    if (!this.running) return 0
    return entryDurationSeconds(this.running, this.now)
  }

  get projectName(): string {
    return this.running?.projectName ?? ''
  }

  /**
   * Take in what the server says is running.
   *
   * Called after a start or stop mutation, and once on mount from the running
   * endpoint, which is what makes a refresh pick the timer back up rather than
   * losing it.
   */
  adopt(entry: TimeEntry | null): void {
    this.running = entry
    this.draftDescription = entry?.description ?? ''
    if (entry) {
      this.now = Date.now()
      this.startTicking()
    } else {
      this.stopTicking()
    }
  }

  setDraftDescription(value: string): void {
    this.draftDescription = value
  }

  private startTicking(): void {
    if (this.ticker !== null) return
    this.ticker = setInterval(() => {
      // The interval fires outside a MobX action, so the write is wrapped.
      runInAction(() => {
        this.now = Date.now()
      })
    }, 1000)
  }

  private stopTicking(): void {
    if (this.ticker === null) return
    clearInterval(this.ticker)
    this.ticker = null
  }

  /** Nothing should tick after the module leaves the screen. */
  dispose(): void {
    this.stopTicking()
  }
}

/** Human-readable elapsed time. Hours only appear once there are any. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`
}
