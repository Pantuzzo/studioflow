/**
 * Everything the app prints that depends on where the reader is.
 *
 * All of it goes through `Intl`, and none of it hardcodes a locale: the
 * platform's `undefined` means "the user's", which is the only locale we
 * actually know. Passing one explicitly is reserved for tests.
 *
 * The rule this module exists to enforce: never assemble a localised string by
 * concatenation. `count + ' ' + noun` is correct in English and wrong almost
 * everywhere else, and it is invisible until someone reads it in Polish.
 */

/**
 * How many minor units make one unit of a currency, as a power of ten.
 *
 * Not always two. Yen and won have none, so their minor unit *is* the unit;
 * Kuwaiti dinar has three. Dividing by 100 is right for the currencies this
 * product bills in today and wrong the moment it bills in another, so the
 * exponent is asked for rather than assumed.
 */
function minorUnitDigits(currency: string, locale?: string): number {
  return (
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  )
}

/** Minor units in the given currency, e.g. 118750 + EUR is €1,187.50. */
export function formatMoney(
  minorUnits: number,
  currency: string,
  locale?: string,
): string {
  const digits = minorUnitDigits(currency, locale)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(minorUnits / 10 ** digits)
}

/**
 * A decimal number of hours, with the right form of the word.
 *
 * English has two forms and needs `1 hour` / `1.5 hours`; other languages have
 * up to six, and `Intl.PluralRules` is what knows which applies. The category
 * for 1.5 is "other" even in English, which is exactly the kind of thing a
 * hand-rolled `n === 1` check gets wrong.
 */
export function formatHours(hours: number, locale?: string): string {
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(hours)
  const category = new Intl.PluralRules(locale).select(hours)
  return `${number} ${category === 'one' ? 'hour' : 'hours'}`
}

/** Plural-aware counting for any noun the app owns. */
export function formatCount(
  count: number,
  forms: { one: string; other: string },
  locale?: string,
): string {
  const number = new Intl.NumberFormat(locale).format(count)
  const category = new Intl.PluralRules(locale).select(count)
  return `${number} ${category === 'one' ? forms.one : forms.other}`
}

export function formatDate(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(iso),
  )
}

export function formatDateTime(iso: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/**
 * "in 12 days" / "3 days ago", in the reader's language.
 *
 * Days rather than a calendar difference: an invoice due tomorrow at 9am and
 * one due tomorrow at 5pm are both "tomorrow" to the person paying it.
 */
export function formatRelativeDays(
  iso: string,
  now: number = Date.now(),
  locale?: string,
): string {
  const days = Math.round(
    (new Date(iso).getTime() - now) / (24 * 60 * 60 * 1000),
  )
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    days,
    'day',
  )
}
