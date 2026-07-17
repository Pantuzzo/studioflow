import { setupServer } from 'msw/node'
import { handlers } from '@/mocks/handlers'

// Used by the Vitest setup file to intercept requests in tests.
export const server = setupServer(...handlers)
