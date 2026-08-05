export interface Client {
  id: string
  name: string
  company: string
  email: string
  /** ISO 4217 currency code, e.g. "USD". Drives locale-aware formatting later. */
  currency: string
  /** ISO 8601 timestamp. */
  createdAt: string
}
