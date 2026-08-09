import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'

const FALLBACK = 'Something went wrong. Please try again.'

/** HTTP status of an RTK Query error, when it has one. */
export function apiErrorStatus(
  error: FetchBaseQueryError | SerializedError | undefined,
): number | undefined {
  if (error && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return undefined
}

/**
 * Pull a human message out of an RTK Query error.
 *
 * The API answers failures with `{ message }`, but a network failure has no
 * body at all — so this narrows carefully rather than reaching blindly into
 * `error.data.message`.
 */
export function apiErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
): string {
  if (!error) return FALLBACK

  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') {
      return 'Could not reach the server. Check your connection.'
    }
    const data = error.data
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
    ) {
      return (data as { message: string }).message
    }
    return FALLBACK
  }

  return error.message ?? FALLBACK
}
