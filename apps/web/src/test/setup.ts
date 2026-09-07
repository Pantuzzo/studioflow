import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { cleanup, configure } from '@testing-library/react'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'

/**
 * Routes behind the session guard are loaded on demand, so rendering one now
 * waits on a dynamic import as well as on the network. The default one-second
 * window is enough on an idle machine and marginal when the whole suite is
 * running, which showed up as tests that passed alone and failed together.
 * Three seconds is still short enough to catch something genuinely stuck.
 */
configure({ asyncUtilTimeout: 3000 })

// Fail loudly on any request the handlers don't cover — keeps the contract honest.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

/**
 * Rewound before each test, not only after.
 *
 * Autosave flushes on unmount, so a write can be dispatched during cleanup and
 * resolve after the teardown has already run — landing one test's document in
 * the next test's fixture. Resetting on the way in makes each test's starting
 * state independent of how tidily the previous one finished.
 */
beforeEach(() => {
  db.reset()
})

afterEach(async () => {
  cleanup()
  // Unmounting can dispatch one last request — autosave flushes there on
  // purpose. Letting it land before the fixture is rewound is what stops it
  // from arriving in the middle of the next test instead.
  await new Promise((resolve) => setTimeout(resolve, 0))
  server.resetHandlers()
  // Sessions and mutations live in the mock db, so it has to be rewound or
  // one test's sign-in would leak into the next.
  db.reset()
  localStorage.clear()
})

afterAll(() => server.close())
