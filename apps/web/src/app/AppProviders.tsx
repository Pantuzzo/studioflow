import type { ReactNode } from 'react'
import { Provider } from 'react-redux'
import { ToastProvider } from '@/components/ui/Toast'
import { store as defaultStore, type AppStore } from '@/app/store'

/**
 * The provider tree, shared by the app entry and the test helpers so the two
 * cannot drift. ToastProvider belongs here: `useToast` throws without it.
 */
export function AppProviders({
  children,
  store = defaultStore,
}: {
  children: ReactNode
  store?: AppStore
}) {
  return (
    <Provider store={store}>
      <ToastProvider>{children}</ToastProvider>
    </Provider>
  )
}
