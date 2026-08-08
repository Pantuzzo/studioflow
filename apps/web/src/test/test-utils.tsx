import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { makeStore, type AppStore, type RootState } from '@/app/store'
import { routes } from '@/routes'

export interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>
  store?: AppStore
  /** Initial URL for the surrounding MemoryRouter. */
  route?: string
}

/**
 * Render inside the real provider tree with a fresh store, so each test gets an
 * isolated RTK Query cache. The options bag is optional, which keeps every
 * existing single-argument call working unchanged.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = makeStore(preloadedState),
    route = '/',
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProviders store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </AppProviders>
    )
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

/**
 * Render the real route tree at a given URL — the only way to exercise the
 * guards, the redirect-back and the 404 as they actually ship.
 */
export function renderApp({
  route = '/',
  preloadedState,
  store = makeStore(preloadedState),
}: {
  route?: string
  preloadedState?: Partial<RootState>
  store?: AppStore
} = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  return {
    store,
    router,
    ...render(
      <AppProviders store={store}>
        <RouterProvider router={router} />
      </AppProviders>,
    ),
  }
}
