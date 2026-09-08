import { expect, test } from '@playwright/test'
import { signIn } from './signIn'

/**
 * A deep link opened by someone signed out lands on the login screen and then
 * continues to where they were going.
 *
 * The unit suite drives this through a memory router. Here it happens the way
 * it actually happens: a cold document load, a guard that redirects before the
 * session check has resolved, and the real History API carrying the intended
 * location in navigation state.
 */
test('a deep link survives the login screen', async ({ page }) => {
  await page.goto('/invoices')

  await expect(page).toHaveURL(/\/login$/)
  await signIn(page)

  await expect(page).toHaveURL(/\/invoices$/)
  await expect(
    page.getByRole('heading', { name: 'Invoices', level: 1 }),
  ).toBeVisible()
})

test('signing in without a destination lands on the dashboard', async ({
  page,
}) => {
  await page.goto('/login')
  await signIn(page)

  await expect(page).toHaveURL(/\/dashboard$/)
})
