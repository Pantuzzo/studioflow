import { useCallback, useRef, useState, type ReactNode } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { ToastContext, type ToastOptions } from './toast-context'
import styles from './Toast.module.css'

interface ToastEntry extends ToastOptions {
  id: number
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 14 14"
      width="12"
      height="12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3.5 3.5 7 7m0-7-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export interface ToastProviderProps {
  children: ReactNode
  /** Auto-dismiss delay in ms. */
  duration?: number
}

export function ToastProvider({
  children,
  duration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const idRef = useRef(0)

  const toast = useCallback((options: ToastOptions) => {
    idRef.current += 1
    setToasts((prev) => [...prev, { id: idRef.current, ...options }])
  }, [])

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider duration={duration} swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={[styles.root, styles[t.variant ?? 'default']]
              .filter(Boolean)
              .join(' ')}
            onOpenChange={(open) => {
              if (!open) remove(t.id)
            }}
          >
            <div className={styles.text}>
              <ToastPrimitive.Title className={styles.title}>
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className={styles.description}>
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className={styles.close} aria-label="Dismiss">
              <CloseIcon />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className={styles.viewport} />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
