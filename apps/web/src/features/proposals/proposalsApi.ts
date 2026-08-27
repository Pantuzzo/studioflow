import { baseApi } from '@/app/baseApi'
import type {
  CreateProposalInput,
  Proposal,
  ProposalSummary,
  UpdateProposalInput,
} from '@studioflow/contracts'

export interface UpdateProposalArgs {
  id: string
  patch: UpdateProposalInput
}

/**
 * Proposals.
 *
 * Two departures from the clients/projects pattern, both deliberate:
 *
 * 1. **Create is not optimistic.** Creating a proposal navigates straight into
 *    its editor, and a placeholder row has no id to navigate to. Waiting for
 *    the server here costs one round trip and saves a whole class of "which id
 *    am I editing" bug.
 * 2. **Autosave does not invalidate the list.** It fires as often as the user
 *    pauses typing, and a refetch of every summary each time would be absurd.
 *    The response reconciles both caches instead.
 */
export const proposalsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProposals: build.query<ProposalSummary[], void>({
      query: () => 'proposals',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Proposal' as const, id })),
              { type: 'Proposal' as const, id: 'LIST' },
            ]
          : [{ type: 'Proposal' as const, id: 'LIST' }],
    }),

    getProposal: build.query<Proposal, string>({
      query: (id) => `proposals/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Proposal', id }],
    }),

    createProposal: build.mutation<Proposal, CreateProposalInput>({
      query: (body) => ({ url: 'proposals', method: 'POST', body }),
      invalidatesTags: [{ type: 'Proposal', id: 'LIST' }],
    }),

    updateProposal: build.mutation<Proposal, UpdateProposalArgs>({
      query: ({ id, patch }) => ({
        url: `proposals/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data: saved } = await queryFulfilled
          // The editor already shows the new document — it is what produced it.
          // These two writes keep the caches from disagreeing with the screen.
          dispatch(
            proposalsApi.util.updateQueryData('getProposal', id, () => saved),
          )
          dispatch(
            proposalsApi.util.updateQueryData(
              'getProposals',
              undefined,
              (draft) => {
                const summary = draft.find((item) => item.id === id)
                if (!summary) return
                summary.title = saved.title
                summary.updatedAt = saved.updatedAt
                summary.projectId = saved.projectId
                summary.projectName = saved.projectName
                summary.blockCount = saved.blocks.length
              },
            ),
          )
        } catch {
          // The editor owns the failure: it keeps the unsaved document and
          // surfaces a retry, so there is nothing to roll back here.
        }
      },
    }),

    deleteProposal: build.mutation<void, string>({
      query: (id) => ({ url: `proposals/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          proposalsApi.util.updateQueryData(
            'getProposals',
            undefined,
            (draft) => {
              const index = draft.findIndex((item) => item.id === id)
              if (index !== -1) draft.splice(index, 1)
            },
          ),
        )
        try {
          await queryFulfilled
        } catch {
          optimistic.undo()
        }
      },
    }),
  }),
})

export const {
  useGetProposalsQuery,
  useGetProposalQuery,
  useCreateProposalMutation,
  useUpdateProposalMutation,
  useDeleteProposalMutation,
} = proposalsApi
