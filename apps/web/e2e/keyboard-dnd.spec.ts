import { expect, test, type Page } from '@playwright/test'
import {
  announcements,
  pickUp,
  recordAnnouncements,
  waitForAnnouncements,
} from './dnd'
import { signIn } from './signIn'

/**
 * The proposal editor's blocks reorder by dragging. This is the spec that
 * justifies the suite existing.
 *
 * dnd-kit's keyboard sensor works by measuring the rectangles of the items it
 * moves between. `happy-dom` reports every rectangle as zero, so in the unit
 * environment a keyboard drag starts and then has nowhere to go: the behaviour
 * is not awkward to test there, it is absent. The unit suite covers the reducer
 * that performs the move; only a browser can prove the keyboard reaches it.
 *
 * What a screen reader is told is asserted as a sequence, because that is what
 * it is. See announcements.ts.
 */

/** The seeded proposal: a heading, a paragraph and a pricing table. */
const PROPOSAL = '/proposals/pp_001'

const INSTRUCTIONS =
  'Use the arrow keys to move it, space to drop, escape to cancel.'

/** Block titles carry their own position, which is what makes order assertable. */
const titles = (page: Page) => page.getByRole('heading', { level: 3 })

async function openEditor(page: Page): Promise<void> {
  await page.goto(PROPOSAL)
  await signIn(page)
  await expect(page.getByLabel('Proposal title')).toHaveValue(/relaunch/)
  await expect(titles(page)).toHaveText([
    'Heading · 1 of 3',
    'Text · 2 of 3',
    'Pricing table · 3 of 3',
  ])
  await recordAnnouncements(page)
}

test('a block reorders from the keyboard, and says so as it moves', async ({
  page,
}) => {
  await openEditor(page)

  await pickUp(page, 'Reorder Heading block, 1 of 3')

  await page.keyboard.press('ArrowDown')
  await waitForAnnouncements(page, 2)

  await page.keyboard.press('Space')
  await waitForAnnouncements(page, 3)

  expect(await announcements(page)).toEqual([
    `Picked up Heading block, position 1 of 3. ${INSTRUCTIONS}`,
    'Heading block is now over position 2 of 3.',
    'Heading block dropped at position 2 of 3.',
  ])

  await expect(titles(page)).toHaveText([
    'Text · 1 of 3',
    'Heading · 2 of 3',
    'Pricing table · 3 of 3',
  ])

  // And the move is saved, not merely rearranged on screen. The status element
  // reaches 'saved' only once the request resolved, and 'idle' is a different
  // value, so this cannot pass on a document that was never sent.
  await expect(page.locator('[data-status="saved"]')).toBeVisible()
})

test('escape puts the block back', async ({ page }) => {
  await openEditor(page)

  await pickUp(page, 'Reorder Pricing table block, 3 of 3')

  await page.keyboard.press('ArrowUp')
  await waitForAnnouncements(page, 2)

  await page.keyboard.press('Escape')
  await waitForAnnouncements(page, 3)

  expect(await announcements(page)).toEqual([
    `Picked up Pricing table block, position 3 of 3. ${INSTRUCTIONS}`,
    'Pricing table block is now over position 2 of 3.',
    'Reorder cancelled. Pricing table block returned to where it started.',
  ])

  await expect(titles(page)).toHaveText([
    'Heading · 1 of 3',
    'Text · 2 of 3',
    'Pricing table · 3 of 3',
  ])
})
