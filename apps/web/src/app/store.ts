import {
  combineReducers,
  configureStore,
  createListenerMiddleware,
} from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '@/app/baseApi'
import { sessionExpired } from '@/app/sessionEvents'

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
})

/** Derived from the reducer, not from a store instance, so preloadedState types. */
export type RootState = ReturnType<typeof rootReducer>

export interface MakeStoreOptions {
  /**
   * Handed to RTK's default enhancers. The app leaves it alone and keeps the
   * default requestAnimationFrame batching; only the test helper overrides it,
   * for a reason documented in `src/test/test-utils.tsx`.
   */
  autoBatch?: false | { type: 'tick' }
}

export function makeStore(
  preloadedState?: Partial<RootState>,
  options?: MakeStoreOptions,
) {
  const listener = createListenerMiddleware()

  // A 401 anywhere means the cached session is a lie. Re-checking it is what
  // flips the route guards over to the login screen.
  listener.startListening({
    actionCreator: sessionExpired,
    effect: (_action, api) => {
      api.dispatch(baseApi.util.invalidateTags(['Me']))
    },
  })

  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) =>
      getDefault().prepend(listener.middleware).concat(baseApi.middleware),
    enhancers: (getDefault) =>
      options?.autoBatch === undefined
        ? getDefault()
        : getDefault({ autoBatch: options.autoBatch }),
  })

  // Enables refetchOnFocus / refetchOnReconnect behaviours.
  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
