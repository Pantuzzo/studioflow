import { baseApi } from '@/app/baseApi'
import { nextPlaceholderId } from '@/app/placeholderId'
import type {
  CreateProjectInput,
  Project,
  UpdateProjectInput,
} from '@studioflow/contracts'

export interface UpdateProjectArgs {
  id: string
  patch: UpdateProjectInput
}

/**
 * Projects CRUD, following the same optimistic-with-rollback shape as
 * [clientsApi](../clients/clientsApi.ts) — see that file for why the writes do
 * not invalidate the list.
 *
 * One difference matters here: a project carries `clientName`, which is derived
 * server-side from `clientId`. An optimistic row therefore has to resolve the
 * name locally or it would render blank for the moment before the response
 * lands, so the caller passes the name it already has on screen.
 */
export const projectsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProjects: build.query<Project[], void>({
      query: () => 'projects',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Project' as const, id })),
              { type: 'Project' as const, id: 'LIST' },
            ]
          : [{ type: 'Project' as const, id: 'LIST' }],
    }),

    createProject: build.mutation<
      Project,
      CreateProjectInput & { clientName: string }
    >({
      query: ({ clientName: _clientName, ...body }) => ({
        url: 'projects',
        method: 'POST',
        body,
      }),
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const placeholderId = nextPlaceholderId()
        const optimistic = dispatch(
          projectsApi.util.updateQueryData(
            'getProjects',
            undefined,
            (draft) => {
              draft.unshift({
                ...input,
                // The optimistic row must have the shape the server returns,
                // and an absent rate is the column's zero.
                hourlyRateCents: input.hourlyRateCents ?? 0,
                id: placeholderId,
                createdAt: new Date().toISOString(),
              })
            },
          ),
        )

        try {
          const { data: created } = await queryFulfilled
          dispatch(
            projectsApi.util.updateQueryData(
              'getProjects',
              undefined,
              (draft) => {
                const index = draft.findIndex((p) => p.id === placeholderId)
                if (index !== -1) draft[index] = created
              },
            ),
          )
        } catch {
          optimistic.undo()
        }
      },
    }),

    updateProject: build.mutation<
      Project,
      UpdateProjectArgs & { clientName?: string }
    >({
      query: ({ id, patch }) => ({
        url: `projects/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      async onQueryStarted(
        { id, patch, clientName },
        { dispatch, queryFulfilled },
      ) {
        const optimistic = dispatch(
          projectsApi.util.updateQueryData(
            'getProjects',
            undefined,
            (draft) => {
              const found = draft.find((p) => p.id === id)
              if (!found) return
              Object.assign(found, patch)
              // Moving the project to another client changes the displayed name,
              // and the server is the one that knows it — until it answers, use
              // the name the form already had.
              if (clientName) found.clientName = clientName
            },
          ),
        )

        try {
          const { data: updated } = await queryFulfilled
          dispatch(
            projectsApi.util.updateQueryData(
              'getProjects',
              undefined,
              (draft) => {
                const index = draft.findIndex((p) => p.id === id)
                if (index !== -1) draft[index] = updated
              },
            ),
          )
        } catch {
          optimistic.undo()
        }
      },
    }),

    deleteProject: build.mutation<void, string>({
      query: (id) => ({ url: `projects/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const optimistic = dispatch(
          projectsApi.util.updateQueryData(
            'getProjects',
            undefined,
            (draft) => {
              const index = draft.findIndex((p) => p.id === id)
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
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = projectsApi
