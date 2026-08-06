import { shouldSkipThrottling } from './throttler.config'

describe('rate limiting', () => {
  it('is skipped only in the test environment', () => {
    expect(shouldSkipThrottling('test')).toBe(true)
  })

  it('stays enabled in production and development', () => {
    // The regression this guards: silently shipping with rate limiting off.
    expect(shouldSkipThrottling('production')).toBe(false)
    expect(shouldSkipThrottling('development')).toBe(false)
    expect(shouldSkipThrottling(undefined)).toBe(false)
  })
})
