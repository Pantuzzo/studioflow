import { describe, expect, it } from 'vitest'
import { intendedPath } from './intendedPath'

describe('intendedPath', () => {
  it('returns the remembered in-app path', () => {
    expect(intendedPath({ from: { pathname: '/clients' } })).toBe('/clients')
  })

  it('keeps the query string', () => {
    expect(
      intendedPath({ from: { pathname: '/clients', search: '?page=2' } }),
    ).toBe('/clients?page=2')
  })

  it('falls back when there is no state', () => {
    expect(intendedPath(null)).toBe('/dashboard')
    expect(intendedPath(undefined)).toBe('/dashboard')
    expect(intendedPath({})).toBe('/dashboard')
  })

  // The reason this function exists rather than using state.from directly.
  it('refuses a protocol-relative path, which would be an open redirect', () => {
    expect(intendedPath({ from: { pathname: '//evil.example/phish' } })).toBe(
      '/dashboard',
    )
  })

  it('refuses an absolute URL', () => {
    expect(
      intendedPath({ from: { pathname: 'https://evil.example/phish' } }),
    ).toBe('/dashboard')
  })

  it('does not bounce back to the auth screens', () => {
    expect(intendedPath({ from: { pathname: '/login' } })).toBe('/dashboard')
    expect(intendedPath({ from: { pathname: '/signup' } })).toBe('/dashboard')
  })
})
