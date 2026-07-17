import { http, HttpResponse } from 'msw'
import { clients } from '@/mocks/db'

/**
 * Request handlers = the REST contract the frontend codes against.
 * Path-only patterns match the request pathname on any origin, so the
 * same handlers work in the browser (worker) and in tests (node server).
 */
export const handlers = [
  http.get('/api/clients', () => {
    return HttpResponse.json(clients)
  }),
]
