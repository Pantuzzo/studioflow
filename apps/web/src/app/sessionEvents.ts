import { createAction } from '@reduxjs/toolkit'

/**
 * Raised when the API answers 401 to a request that expected a live session.
 *
 * It exists to break an import cycle: the base query cannot import `baseApi`
 * (which imports the base query), so it dispatches this instead and the store —
 * which already knows about both — reacts by invalidating the session.
 */
export const sessionExpired = createAction('session/expired')
