import type {
  ForgotPasswordInput,
  LoginInput,
  Session,
  SignupInput,
} from '@studioflow/contracts'
import { baseApi } from '@/app/baseApi'

/**
 * The session lives in the RTK Query cache, not in a slice.
 *
 * With a cookie session there is nothing for the client to hold: `getMe` is the
 * session state — loading means "still checking", success means signed in, 401
 * means anonymous. A slice mirroring that would be a second source of truth.
 * See docs/adr/0006.
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMe: build.query<Session, void>({
      query: () => 'auth/me',
      providesTags: ['Me'],
    }),

    login: build.mutation<Session, LoginInput>({
      query: (body) => ({ url: 'auth/login', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),

    signup: build.mutation<Session, SignupInput>({
      query: (body) => ({ url: 'auth/signup', method: 'POST', body }),
      invalidatesTags: ['Me'],
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      // Drop every cached response, not just the session: the next person to
      // use this browser must not see the previous one's data.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),

    forgotPassword: build.mutation<{ message: string }, ForgotPasswordInput>({
      query: (body) => ({ url: 'auth/forgot-password', method: 'POST', body }),
    }),
  }),
})

export const {
  useGetMeQuery,
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
} = authApi
