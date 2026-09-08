import { expect, test } from '@playwright/test'
import { signIn } from './signIn'

/**
 * There is no PDF library here. An invoice prints through the browser's own
 * pipeline, and a print stylesheet decides what is document and what is
 * application.
 *
 * `@media print` is applied by a rendering engine. The unit environment has
 * none, so this rule has no other place it can be tested — which is how a
 * print stylesheet quietly rots.
 */
test('printing an invoice leaves the application behind', async ({ page }) => {
  await page.goto('/invoices/in_001')
  await signIn(page)

  const nav = page.getByRole('navigation', { name: 'Primary' })
  const toolbarLink = page.getByRole('link', { name: 'All invoices' })
  const printButton = page.getByRole('button', { name: 'Print or save as PDF' })
  const heading = page.getByRole('heading', { name: 'Invoice #1', level: 1 })

  await expect(nav).toBeVisible()
  await expect(toolbarLink).toBeVisible()
  await expect(printButton).toBeVisible()
  await expect(heading).toBeVisible()

  await page.emulateMedia({ media: 'print' })

  // The navigation, the status controls and the button that started the print
  // are all chrome. None of them belongs on a document sent to a client.
  await expect(nav).toBeHidden()
  await expect(toolbarLink).toBeHidden()
  await expect(printButton).toBeHidden()

  // The invoice itself stays, obviously — including the line items, which is
  // the part that would be embarrassing to lose.
  await expect(heading).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
})
