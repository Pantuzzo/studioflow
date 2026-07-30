import { createContext, useContext } from 'react'

export type ToastVariant = 'default' | 'success' | 'error'

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
}

export interface ToastApi {
  toast: (options: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/** Imperatively push a toast. Must be called within <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider>')
  }
  return ctx
}
