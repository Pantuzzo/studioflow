import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import * as axeMatchers from 'vitest-axe/matchers'
import { db } from '@/mocks/db'
import { renderApp } from '@/test/test-utils'

expect.extend(axeMatchers)

/**
 * axe over the real screens, in CI.
 *
 * The project's definition of done has claimed "accessible, axe clean" since
 * week one, and until now that was checked by hand in Storybook's a11y panel.
 * A claim nobody re-checks is a claim that expires, so it runs here on every
 * push instead.
 *
 * What this does not do is replace judgement. axe finds a minority of real
 * barriers: contrast, missing names, broken relationships. It cannot tell
 * whether a drag handle can be operated from a keyboard, which is why the
 * proposal editor has its own tests for exactly that.
 */

async function expectClean(route: string, ready: () => Promise<unknown>) {
  const { container } = renderApp({ route })
  await ready()
  const results = await axe(container)
  expect(results).toHaveNoViolations()
}

/**
 * The timesheet is virtualized, and the virtualizer sizes its window from
 * `offsetHeight`, which happy-dom reports as zero for everything. Without a
 * viewport it renders no rows, and rows are the markup worth auditing.
 */
const originals = ['offsetHeight', 'offsetWidth'].map(
  (name) =>
    [
      name,
      Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
    ] as const,
)

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 640,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 800,
  })

  const user = db.findUserByEmail('ava@northwind.studio')
  if (user) db.signIn(user.id)
})

afterEach(() => {
  for (const [name, descriptor] of originals) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
    } else {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
    }
  }
})

describe('accessibility', () => {
  it('has no violations on the sign-in screen', async () => {
    db.signOut()
    await expectClean('/login', () =>
      screen.findByRole('button', { name: /sign in/i }),
    )
  })

  it('has no violations on the clients list', async () => {
    await expectClean('/clients', () => screen.findByText('Northwind Studio'))
  })

  it('has no violations on the projects list', async () => {
    await expectClean('/projects', () => screen.findByText('Website relaunch'))
  })

  it('has no violations on the timesheet', async () => {
    await expectClean('/time', () => screen.findByText('Wireframes'))
  })

  it('has no violations on the invoice document', async () => {
    await expectClean('/invoices/in_001', () => screen.findByText('Invoice #1'))
  })

  it('has no violations in the proposal editor', async () => {
    // The most structurally complex screen in the app: a list of editable
    // regions, each with a drag handle and a menu.
    await expectClean('/proposals/pp_001', () =>
      screen.findByLabelText('Proposal title'),
    )
  })
})
