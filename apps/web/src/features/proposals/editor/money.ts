import type { LineItem } from '@studioflow/contracts'

/**
 * Money lives in integer minor units everywhere except the input the user
 * types into. These functions are the only place the two representations meet,
 * so rounding happens once, in the open.
 */

/** Format minor units in the client's currency. */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/** What the price input shows: major units, always two decimals. */
export function moneyInputValue(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * Read a typed price into minor units. Returns null for anything that is not a
 * number, so the caller can leave the previous value alone rather than storing
 * NaN — which would sail through the schema's `.int()` check as a rejection at
 * save time, long after the user could connect it to what they typed.
 */
export function parseMoneyInput(value: string): number | null {
  const normalised = value.trim().replace(',', '.')
  if (normalised === '') return 0
  const amount = Number(normalised)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100)
}

/** Quantities may be fractional; a total may not. Rounded per line, as invoices do. */
export function lineTotalCents(
  item: Pick<LineItem, 'quantity' | 'unitPriceCents'>,
): number {
  return Math.round(item.quantity * item.unitPriceCents)
}

export function itemsTotalCents(items: readonly LineItem[]): number {
  return items.reduce((total, item) => total + lineTotalCents(item), 0)
}

/** Read a typed quantity; null when it is not a usable number. */
export function parseQuantityInput(value: string): number | null {
  const normalised = value.trim().replace(',', '.')
  if (normalised === '') return 0
  const quantity = Number(normalised)
  if (!Number.isFinite(quantity) || quantity < 0) return null
  return quantity
}
