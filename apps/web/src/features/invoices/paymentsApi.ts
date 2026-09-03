import { baseApi } from '@/app/baseApi'
import type { CheckoutSession } from '@studioflow/contracts'

/**
 * Payments.
 *
 * There is exactly one endpoint, and it deliberately does not change anything
 * the UI shows. Asking for a checkout page is not a payment; the invoice moves
 * only when Stripe says so, through a webhook this app never sees from the
 * browser. So nothing is invalidated here and nothing is optimistic.
 */
export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createCheckout: build.mutation<CheckoutSession, string>({
      query: (invoiceId) => ({
        url: `invoices/${invoiceId}/checkout`,
        method: 'POST',
      }),
    }),
  }),
})

export const { useCreateCheckoutMutation } = paymentsApi
