import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '@/mocks/db'
import { server } from '@/mocks/server'

// Fail loudly on any request the handlers don't cover — keeps the contract honest.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Sessions and mutations live in the mock db, so it has to be rewound or
  // one test's sign-in would leak into the next.
  db.reset()
  localStorage.clear()
})
afterAll(() => server.close())
