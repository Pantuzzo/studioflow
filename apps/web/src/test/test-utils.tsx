import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { baseApi } from '@/app/baseApi'

/**
 * Render a component with a fresh store (isolated RTK Query cache per test).
 * Extend with a MemoryRouter wrapper once routed components need it.
 */
export function renderWithProviders(ui: ReactElement) {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  })
  setupListeners(store.dispatch)
  return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}
