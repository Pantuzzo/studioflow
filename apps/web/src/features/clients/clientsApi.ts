import { baseApi } from '@/app/baseApi'
import { nextPlaceholderId } from '@/app/placeholderId'
import type {
  Client,
  CreateClientInput,
  UpdateClientInput,
} from '@studioflow/contracts'

export interface UpdateClientArgs {
  id: string
  patch: UpdateClientInput
}

/**
 * Clients CRUD.
 *
 * Every write is applied to the cache first and reconciled with the server's
 * response afterwards, so the UI answers immediately and still ends up holding
 * exactly what the database holds. `updateQueryData` returns the inverse patch,
 * which is what makes rollback a one-liner: if the request rejects, `.undo()`
 * puts the cache back the way it was and the user sees the row return.
 *
 * Note what is deliberately missing: `invalidatesTags`. Invalidating the list
 * would fire a refetch that overwrites the optimistic state a moment later,
 * which is the cost the optimism was meant to avoid. The response body is the
 * reconciliation instead. The tradeoff is that a write here does not refresh
 * anything else keyed on 'Client'; when a second consumer appears (a dashboard
 * count, say), it invalidates from its own endpoint or reads this cache.
 */
export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<Client[], void>({
      query: () => 'clients',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Client' as const, id })),
              { type: 'Client' as const, id: 'LIST' },
            ]
          : [{ type: 'Client' as const, id: 'LIST' }],
    }),

    createClient: build.mutation<Client, CreateClientInput>({
      query: (body) => ({ url: 'clients', method: 'POST', body }),
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const placeholderId = nextPlaceholderId()
        // The list is newest-first, so an optimistic row belongs at the top.
        const optimistic = dispatch(
          clientsApi.util.updateQueryData('getClients', undefined, (draft) => {
            draft.unshift({
              ...input,
              id: placeholderId,
              createdAt: new Date().toISOString(),
            })
          }),
        )

        try {
          const { data: created } = await queryFulfilled
          // Swap the placeholder for the real row: the id and createdAt are the
          // server's to assign, and the id is what edit and delete address.
          dispatch(
            clientsApi.util.updateQueryData(
              'getClients',
              undefined,
              (draft) => {
                const index = draft.findIndex((c) => c.id === placeholderId)
                if (index !== -1) draft[index] = created
              },
            ),
          )
        } catch {
          optimistic.undo()
        }
      },
    }),

    updateClient: build.mutation<Client, UpdateClientArgs>({
      query: ({ id, patch }) => ({
        url: `clients/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      async onQueryStarted({ id, patch }, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          clientsApi.util.updateQueryData('getClients', undefined, (draft) => {
            const found = draft.find((c) => c.id === id)
            if (found) Object.assign(found, patch)
          }),
        )

        try {
          const { data: updated } = await queryFulfilled
          // The server may have normalised the input — trimmed a name, say — so
          // its row wins over the one typed into the form.
          dispatch(
            clientsApi.util.updateQueryData(
              'getClients',
              undefined,
              (draft) => {
                const index = draft.findIndex((c) => c.id === id)
                if (index !== -1) draft[index] = updated
              },
            ),
          )
        } catch {
          optimistic.undo()
        }
      },
    }),

    deleteClient: build.mutation<void, string>({
      query: (id) => ({ url: `clients/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          clientsApi.util.updateQueryData('getClients', undefined, (draft) => {
            const index = draft.findIndex((c) => c.id === id)
            if (index !== -1) draft.splice(index, 1)
          }),
        )

        try {
          await queryFulfilled
        } catch {
          // Restores the row at its original position, not at the end.
          optimistic.undo()
        }
      },
    }),
  }),
})

export const {
  useGetClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} = clientsApi
