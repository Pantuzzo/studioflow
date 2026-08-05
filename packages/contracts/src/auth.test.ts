import { describe, expect, it } from 'vitest'
import {
  clientSchema,
  loginSchema,
  sessionSchema,
  signupFormSchema,
  signupSchema,
} from './index'

const USER = {
  id: '3f1a6b1e-6b0e-4f52-9d1a-2b7c8e5d0a11',
  name: 'Ava Thompson',
  email: 'ava@northwind.studio',
}

describe('loginSchema', () => {
  it('accepts a valid credential pair', () => {
    expect(
      loginSchema.safeParse({ email: USER.email, password: 'secret' }).success,
    ).toBe(true)
  })

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: 'secret' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Enter a valid email address')
  })
})

describe('signupSchema (wire contract)', () => {
  it('does not carry confirmPassword — that is a UI concern', () => {
    const parsed = signupSchema.parse({
      name: USER.name,
      email: USER.email,
      password: 'longenough',
      confirmPassword: 'longenough',
    })
    expect(parsed).not.toHaveProperty('confirmPassword')
  })

  it('enforces the password floor', () => {
    const result = signupSchema.safeParse({
      name: USER.name,
      email: USER.email,
      password: 'short',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Use at least 8 characters')
  })

  it('caps password length so hashing cannot be weaponised', () => {
    const result = signupSchema.safeParse({
      name: USER.name,
      email: USER.email,
      password: 'a'.repeat(129),
    })
    expect(result.success).toBe(false)
  })
})

describe('signupFormSchema (UI)', () => {
  it('reports mismatched passwords on the confirmation field', () => {
    const result = signupFormSchema.safeParse({
      name: USER.name,
      email: USER.email,
      password: 'longenough',
      confirmPassword: 'different',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
    expect(result.error?.issues[0]?.message).toBe('Passwords do not match')
  })

  it('accepts matching passwords', () => {
    expect(
      signupFormSchema.safeParse({
        name: USER.name,
        email: USER.email,
        password: 'longenough',
        confirmPassword: 'longenough',
      }).success,
    ).toBe(true)
  })
})

describe('sessionSchema', () => {
  // Guards the security decision in ADR 0006: the browser never receives a token.
  // If the API ever grew one, it would be stripped here rather than silently typed.
  it('exposes the user and nothing token-shaped', () => {
    const parsed = sessionSchema.parse({
      user: USER,
      accessToken: 'leaked.jwt.value',
    })
    expect(parsed).toEqual({ user: USER })
    expect(Object.keys(parsed)).toEqual(['user'])
  })
})

describe('clientSchema', () => {
  it('accepts the seeded client shape', () => {
    expect(
      clientSchema.safeParse({
        id: 'cl_001',
        name: 'Ava Thompson',
        company: 'Northwind Studio',
        email: 'ava@northwind.studio',
        currency: 'USD',
        createdAt: '2026-01-12T09:00:00.000Z',
      }).success,
    ).toBe(true)
  })

  it('rejects a currency that is not an ISO 4217 code', () => {
    expect(
      clientSchema.safeParse({
        id: 'cl_001',
        name: 'Ava Thompson',
        company: 'Northwind Studio',
        email: 'ava@northwind.studio',
        currency: 'Dollars',
        createdAt: '2026-01-12T09:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
