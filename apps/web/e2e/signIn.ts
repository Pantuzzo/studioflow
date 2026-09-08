import { expect, type Page } from '@playwright/test'
import { SEED_EMAIL, SEED_PASSWORD } from '../src/mocks/db'

/**
 * Sign in through the form, as a person would.
 *
 * The credentials come from the mock database rather than being repeated here,
 * so the suite cannot drift from the fixture it runs against.
 *
 * Worth knowing while reading these tests: in mock mode the session lives in
 * the page, because the "server" is a worker inside it. A full reload signs you
 * out. That is a property of the demo build, not of the app — the real API
 * keeps the session in an httpOnly cookie — so nothing here reloads to prove
 * persistence.
 */
export async function signIn(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.getByLabel('Email').fill(SEED_EMAIL)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}
