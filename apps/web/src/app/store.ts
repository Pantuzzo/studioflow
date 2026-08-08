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

export function makeStore(preloadedState?: Partial<RootState>) {
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
  })

  // Enables refetchOnFocus / refetchOnReconnect behaviours.
  setupListeners(store.dispatch)
  return store
}

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']
