import { expect, test } from '@playwright/test'
import { signIn } from './signIn'

/**
 * Week nine split the routes behind the guard into their own chunks. The bundle
 * budget in CI measures bytes on disk, which is a different claim: it can pass
 * while the login screen still downloads the whole application.
 *
 * Whether a chunk is fetched is a network fact, and only a browser has one.
 */
test('the signed-out screen does not download what is behind the guard', async ({
  page,
}) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })

  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

  // Vite names a chunk after the module that owns it, so the file names are
  // the assertion. These three are the heavy ones: the drag-and-drop editor,
  // the virtualized timesheet that brings MobX with it, and the invoice.
  const atLogin = scripts.join('\n')
  expect(atLogin).not.toMatch(/ProposalEditorPage/)
  expect(atLogin).not.toMatch(/TimeTrackingPage/)
  expect(atLogin).not.toMatch(/InvoiceDetailPage/)

  const beforeSigningIn = scripts.length

  await signIn(page)
  await page.getByRole('link', { name: 'Proposals' }).click()
  await expect(
    page.getByRole('heading', { name: 'Proposals', level: 1 }),
  ).toBeVisible()
  await page.getByRole('link', { name: /^Website relaunch/ }).click()
  await expect(page.getByLabel('Proposal title')).toBeVisible()

  // And it arrives when it is actually needed, rather than never — a route
  // that silently fails to load its chunk looks identical to one that was
  // never split.
  const fetchedAfterwards = scripts.slice(beforeSigningIn).join('\n')
  expect(fetchedAfterwards).toMatch(/ProposalEditorPage/)
})
