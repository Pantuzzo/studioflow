import { baseApi } from '@/app/baseApi'
import type { Client } from '@studioflow/contracts'

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
  }),
})

export const { useGetClientsQuery } = clientsApi
