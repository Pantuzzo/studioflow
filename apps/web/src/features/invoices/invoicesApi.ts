import { baseApi } from '@/app/baseApi'
import type {
  GenerateInvoiceInput,
  Invoice,
  InvoiceSummary,
  UpdateInvoiceInput,
} from '@studioflow/contracts'

export interface UpdateInvoiceArgs {
  id: string
  patch: UpdateInvoiceInput
}

const LIST = { type: 'Invoice' as const, id: 'LIST' }

/**
 * Invoices.
 *
 * Nothing here is optimistic. Generating one is the server reading tracked
 * time and deciding what is owed, so there is no local answer to show early;
 * and marking one paid is a fact about money that should appear once the
 * server agrees, not a moment before.
 *
 * Generating also changes time entries, so the time-entry list is invalidated
 * with it. Without that, the timesheet would still offer hours that have just
 * been billed.
 */
export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<InvoiceSummary[], void>({
      query: () => 'invoices',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Invoice' as const, id })),
              LIST,
            ]
          : [LIST],
    }),

    getInvoice: build.query<Invoice, string>({
      query: (id) => `invoices/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Invoice', id }],
    }),

    generateInvoice: build.mutation<Invoice, GenerateInvoiceInput>({
      query: (body) => ({ url: 'invoices/generate', method: 'POST', body }),
      invalidatesTags: [LIST, { type: 'TimeEntry', id: 'LIST' }],
    }),

    updateInvoice: build.mutation<Invoice, UpdateInvoiceArgs>({
      query: ({ id, patch }) => ({
        url: `invoices/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        LIST,
        { type: 'Invoice', id },
      ],
    }),

    deleteInvoice: build.mutation<void, string>({
      query: (id) => ({ url: `invoices/${id}`, method: 'DELETE' }),
      // Deleting releases the hours, so the timesheet has to hear about it.
      invalidatesTags: [LIST, { type: 'TimeEntry', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useGenerateInvoiceMutation,
  useUpdateInvoiceMutation,
  useDeleteInvoiceMutation,
} = invoicesApi
