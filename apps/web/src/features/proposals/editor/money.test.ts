import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  itemsTotalCents,
  lineTotalCents,
  moneyInputValue,
  parseMoneyInput,
  parseQuantityInput,
} from './money'

describe('parseMoneyInput', () => {
  it('reads major units into minor units', () => {
    expect(parseMoneyInput('95')).toBe(9500)
    expect(parseMoneyInput('95.5')).toBe(9550)
    expect(parseMoneyInput('0.07')).toBe(7)
  })

  it('accepts a comma, because half the world types one', () => {
    expect(parseMoneyInput('95,50')).toBe(9550)
  })

  it('treats an empty field as zero rather than as an error', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('   ')).toBe(0)
  })

  it('returns null for anything that is not a usable amount', () => {
    expect(parseMoneyInput('abc')).toBeNull()
    expect(parseMoneyInput('-5')).toBeNull()
    expect(parseMoneyInput('1e999')).toBeNull() // Infinity
  })

  it('rounds rather than truncating the third decimal', () => {
    expect(parseMoneyInput('0.005')).toBe(1)
    expect(parseMoneyInput('0.004')).toBe(0)
    // The classic: 1.005 in binary floating point is just under 1.005.
    expect(parseMoneyInput('10.555')).toBe(1056)
  })
})

describe('moneyInputValue', () => {
  it('round-trips through the input', () => {
    for (const cents of [0, 7, 9500, 123456]) {
      expect(parseMoneyInput(moneyInputValue(cents))).toBe(cents)
    }
  })
})

describe('lineTotalCents', () => {
  it('multiplies a fractional quantity and rounds to whole cents', () => {
    expect(lineTotalCents({ quantity: 12.5, unitPriceCents: 9500 })).toBe(
      118750,
    )
    // 0.1 * 3 is famously not 0.3 in floating point; the result is still whole.
    expect(lineTotalCents({ quantity: 3, unitPriceCents: 10 })).toBe(30)
    expect(
      Number.isInteger(
        lineTotalCents({ quantity: 1.005, unitPriceCents: 999 }),
      ),
    ).toBe(true)
  })
})

describe('itemsTotalCents', () => {
  it('rounds per line, then sums — which is what an invoice does', () => {
    const total = itemsTotalCents([
      { id: 'a', description: '', quantity: 0.333, unitPriceCents: 100 },
      { id: 'b', description: '', quantity: 0.333, unitPriceCents: 100 },
      { id: 'c', description: '', quantity: 0.333, unitPriceCents: 100 },
    ])
    // 33.3 rounds to 33 on each line: 99, not the 100 a single multiplication
    // would give. Consistency with the printed line totals matters more.
    expect(total).toBe(99)
  })

  it('is zero for an empty table', () => {
    expect(itemsTotalCents([])).toBe(0)
  })
})

describe('parseQuantityInput', () => {
  it('allows fractions and rejects nonsense', () => {
    expect(parseQuantityInput('0.25')).toBe(0.25)
    expect(parseQuantityInput('')).toBe(0)
    expect(parseQuantityInput('-1')).toBeNull()
    expect(parseQuantityInput('two')).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formats in the currency it is given', () => {
    // Locale-dependent separators and symbol placement, so the assertion is on
    // the parts that do not move.
    const eur = formatMoney(118750, 'EUR')
    expect(eur).toContain('187')
    expect(eur).toMatch(/€|EUR/)

    const usd = formatMoney(9500, 'USD')
    expect(usd).toContain('95')
    expect(usd).toMatch(/\$|USD/)
  })
})
