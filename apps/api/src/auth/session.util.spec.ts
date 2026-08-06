import {
  csrfCookieOptions,
  generateToken,
  hashToken,
  safeEquals,
  sessionCookieName,
  sessionCookieOptions,
} from './session.util'

describe('session tokens', () => {
  it('generates a distinct high-entropy token each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken()))
    expect(tokens.size).toBe(50)
    // 32 random bytes in base64url
    expect([...tokens][0]).toHaveLength(43)
  })

  it('hashes deterministically and never returns the token itself', () => {
    const token = generateToken()
    const digest = hashToken(token)
    expect(digest).toBe(hashToken(token))
    expect(digest).not.toBe(token)
    expect(digest).toHaveLength(64)
  })

  it('compares in constant time without throwing on length mismatch', () => {
    const token = generateToken()
    expect(safeEquals(token, token)).toBe(true)
    expect(safeEquals(token, generateToken())).toBe(false)
    expect(safeEquals('short', 'muchlongervalue')).toBe(false)
  })
})

describe('cookie hardening', () => {
  it('uses the __Host- prefix only in production', () => {
    expect(sessionCookieName(true)).toBe('__Host-sf_session')
    expect(sessionCookieName(false)).toBe('sf_session')
  })

  it('keeps the session cookie unreadable by JavaScript', () => {
    const options = sessionCookieOptions(true, 60)
    expect(options.httpOnly).toBe(true)
    expect(options.secure).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
  })

  it('keeps the CSRF cookie readable, since the client must echo it', () => {
    expect(csrfCookieOptions(true, 60).httpOnly).toBe(false)
  })

  it('does not set Secure in development, where there is no https', () => {
    expect(sessionCookieOptions(false, 60).secure).toBe(false)
  })
})
