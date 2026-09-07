import { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    __dndAnnouncements?: string[]
  }
}

/**
 * Record everything dnd-kit puts into its live region, in order.
 *
 * Sampling the region with an ordinary assertion does not work, and finding out
 * why is the reason this file exists: several announcements can land in a
 * single React commit, so the DOM never holds the earlier ones long enough to
 * be observed. A polling assertion sees the survivor and reports the others as
 * missing — or worse, passes on the wrong one.
 *
 * A MutationObserver installed before the drag sees every value, which is also
 * closer to what a screen reader consumes: a sequence, not a snapshot.
 */
export async function recordAnnouncements(page: Page): Promise<void> {
  await page.evaluate(() => {
    const region = document.querySelector('[id^="DndLiveRegion"]')
    if (!region) throw new Error('dnd-kit live region not found')

    const log: string[] = []
    window.__dndAnnouncements = log

    new MutationObserver(() => {
      const text = region.textContent?.trim() ?? ''
      if (text && log[log.length - 1] !== text) log.push(text)
    }).observe(region, { childList: true, subtree: true, characterData: true })
  })
}

export async function announcements(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__dndAnnouncements ?? [])
}

/**
 * Wait for the next announcement rather than for a duration.
 *
 * Pressing a key and asserting immediately is a race the test loses roughly at
 * random: the drag has not finished activating and the key goes nowhere.
 */
export async function waitForAnnouncements(
  page: Page,
  count: number,
): Promise<void> {
  await expect
    .poll(async () => (await announcements(page)).length)
    .toBeGreaterThanOrEqual(count)
}

/**
 * Press space to pick a block up, and wait until the drag can actually receive
 * an arrow key.
 *
 * dnd-kit attaches its keydown listener inside a `setTimeout` (`KeyboardSensor`,
 * `attach()`), so an arrow pressed in the same tick as the activation is not
 * merely early: nothing is listening yet and the key is dropped. Under load —
 * which is to say, whenever these specs run in parallel — that is a coin flip.
 *
 * Draining one macrotask in the page settles it, and settles it deterministically
 * rather than by sleeping: timers of equal delay run in the order they were
 * scheduled, and dnd-kit scheduled its first.
 */
export async function pickUp(page: Page, handle: string): Promise<void> {
  await page.getByRole('button', { name: handle }).press('Space')
  await waitForAnnouncements(page, 1)
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  )
}
