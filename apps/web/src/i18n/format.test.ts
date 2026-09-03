import { describe, expect, it } from 'vitest'
import {
  formatCount,
  formatDate,
  formatHours,
  formatMoney,
  formatRelativeDays,
} from './format'

/**
 * These pass a locale explicitly, which production never does. The point is to
 * assert that the behaviour changes with the locale at all: a formatter that
 * ignores it would pass an en-US-only test suite and fail every reader.
 */

describe('formatMoney', () => {
  it('places the symbol where the locale places it', () => {
    expect(formatMoney(118_750, 'EUR', 'de-DE')).toMatch(/1\.187,50\s?€/)
    expect(formatMoney(118_750, 'EUR', 'en-US')).toBe('€1,187.50')
  })

  it('uses the separators the locale uses', () => {
    // The same amount, written three ways. Concatenating "R$ " + value would
    // get all three wrong.
    expect(formatMoney(950_000, 'BRL', 'pt-BR')).toMatch(/R\$\s?9\.500,00/)
    expect(formatMoney(950_000, 'USD', 'en-US')).toBe('$9,500.00')
  })

  it('knows that a minor unit is not always one hundredth', () => {
    // Yen has no minor unit at all, so 950000 of them is ¥950,000 and not
    // ¥9,500. Dividing by 100 unconditionally is the bug this guards.
    expect(formatMoney(950_000, 'JPY', 'en-US')).toBe('¥950,000')
    // Two decimals still behave, of course.
    expect(formatMoney(950_000, 'USD', 'en-US')).toBe('$9,500.00')
  })
})

describe('formatHours', () => {
  it('uses the singular only for exactly one', () => {
    expect(formatHours(1, 'en-US')).toBe('1 hour')
    expect(formatHours(0, 'en-US')).toBe('0 hours')
    expect(formatHours(2, 'en-US')).toBe('2 hours')
  })

  it('treats a fraction as plural, which a naive check gets wrong', () => {
    // English plural category for 1.5 is "other", not "one".
    expect(formatHours(1.5, 'en-US')).toBe('1.5 hours')
  })

  it('formats the number itself for the locale', () => {
    expect(formatHours(1.5, 'de-DE')).toBe('1,5 hours')
  })

  it('caps the decimals rather than printing float noise', () => {
    expect(formatHours(0.1 + 0.2, 'en-US')).toBe('0.3 hours')
  })
})

describe('formatCount', () => {
  it('picks the form by plural category, not by equality with one', () => {
    const forms = { one: 'invoice', other: 'invoices' }
    expect(formatCount(1, forms, 'en-US')).toBe('1 invoice')
    expect(formatCount(3, forms, 'en-US')).toBe('3 invoices')
    expect(formatCount(0, forms, 'en-US')).toBe('0 invoices')
  })
})

describe('formatDate', () => {
  it('orders the parts the way the locale does', () => {
    const iso = '2026-08-17T09:00:00.000Z'
    // Month first in the US, day first almost everywhere else.
    expect(formatDate(iso, 'en-US')).toMatch(/Aug 17, 2026/)
    expect(formatDate(iso, 'en-GB')).toMatch(/17 Aug 2026/)
  })
})

describe('formatRelativeDays', () => {
  const now = new Date('2026-08-17T12:00:00.000Z').getTime()

  it('says tomorrow and yesterday rather than counting to one', () => {
    expect(formatRelativeDays('2026-08-18T12:00:00.000Z', now, 'en-US')).toBe(
      'tomorrow',
    )
    expect(formatRelativeDays('2026-08-16T12:00:00.000Z', now, 'en-US')).toBe(
      'yesterday',
    )
  })

  it('counts days in either direction', () => {
    expect(formatRelativeDays('2026-08-31T12:00:00.000Z', now, 'en-US')).toBe(
      'in 14 days',
    )
    expect(formatRelativeDays('2026-08-03T12:00:00.000Z', now, 'en-US')).toBe(
      '14 days ago',
    )
  })
})
