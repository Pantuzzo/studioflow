import { baseApi } from '@/app/baseApi'
import type {
  CreateTimeEntryInput,
  StartTimerInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from '@studioflow/contracts'

export interface UpdateTimeEntryArgs {
  id: string
  patch: UpdateTimeEntryInput
}

const LIST = { type: 'TimeEntry' as const, id: 'LIST' }

/**
 * The server's half of time tracking.
 *
 * Unlike the proposal editor's autosave, these writes do invalidate the list.
 * Starting and stopping a timer are deliberate, occasional acts, not
 * keystrokes, so one refetch each is the right trade for never having to
 * reconcile a list by hand.
 */
export const timeEntriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTimeEntries: build.query<TimeEntry[], void>({
      query: () => 'time-entries',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'TimeEntry' as const, id })),
              LIST,
            ]
          : [LIST],
    }),

    getRunningEntry: build.query<TimeEntry | null, void>({
      query: () => 'time-entries/running',
      // "Nothing is running" comes back as an empty body rather than a 404,
      // because it is an answer, not a missing resource.
      transformResponse: (response: TimeEntry | Record<string, never>) =>
        response && 'id' in response ? (response as TimeEntry) : null,
      providesTags: [{ type: 'TimeEntry', id: 'RUNNING' }],
    }),

    startTimer: build.mutation<TimeEntry, StartTimerInput>({
      query: (body) => ({ url: 'time-entries/start', method: 'POST', body }),
      invalidatesTags: [LIST, { type: 'TimeEntry', id: 'RUNNING' }],
    }),

    stopTimer: build.mutation<TimeEntry, string>({
      query: (id) => ({ url: `time-entries/${id}/stop`, method: 'POST' }),
      invalidatesTags: [LIST, { type: 'TimeEntry', id: 'RUNNING' }],
    }),

    createTimeEntry: build.mutation<TimeEntry, CreateTimeEntryInput>({
      query: (body) => ({ url: 'time-entries', method: 'POST', body }),
      invalidatesTags: [LIST],
    }),

    updateTimeEntry: build.mutation<TimeEntry, UpdateTimeEntryArgs>({
      query: ({ id, patch }) => ({
        url: `time-entries/${id}`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        LIST,
        { type: 'TimeEntry', id },
      ],
    }),

    deleteTimeEntry: build.mutation<void, string>({
      query: (id) => ({ url: `time-entries/${id}`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        // Deleting a row is the one write here worth doing optimistically: the
        // row is what the user is looking at when they press the button.
        const optimistic = dispatch(
          timeEntriesApi.util.updateQueryData(
            'getTimeEntries',
            undefined,
            (draft) => {
              const index = draft.findIndex((entry) => entry.id === id)
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
  useGetTimeEntriesQuery,
  useGetRunningEntryQuery,
  useStartTimerMutation,
  useStopTimerMutation,
  useCreateTimeEntryMutation,
  useUpdateTimeEntryMutation,
  useDeleteTimeEntryMutation,
} = timeEntriesApi
