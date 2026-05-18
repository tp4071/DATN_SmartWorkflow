import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

const ToastContext = createContext(null)

const TONE = {
  success: { icon: 'check_circle', cls: 'bg-success-50 text-success-600 border-success-600/30' },
  error: { icon: 'error', cls: 'bg-danger-50 text-danger-500 border-danger-500/30' },
  info: { icon: 'info', cls: 'bg-primary-50 text-primary-700 border-primary-100' },
  warning: { icon: 'warning', cls: 'bg-tertiary-50 text-tertiary-700 border-tertiary-300' },
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setItems((arr) => arr.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info', { duration = 3500 } = {}) => {
      const id = ++idRef.current
      setItems((arr) => [...arr, { id, message, tone }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      push,
      success: (m, opts) => push(m, 'success', opts),
      error: (m, opts) => push(m, 'error', opts),
      info: (m, opts) => push(m, 'info', opts),
      warning: (m, opts) => push(m, 'warning', opts),
      dismiss,
    }),
    [push, dismiss],
  )

  const target = typeof document !== 'undefined' ? document.getElementById('toast-root') : null

  return (
    <ToastContext.Provider value={api}>
      {children}
      {target
        ? createPortal(
            <>
              {items.map((t) => {
                const tone = TONE[t.tone] ?? TONE.info
                return (
                  <div
                    key={t.id}
                    role="status"
                    className={`pointer-events-auto flex items-start gap-2 min-w-[260px] max-w-[360px] px-4 py-3 rounded-lg border shadow-md text-sm toast-anim ${tone.cls}`}
                  >
                    <Icon name={tone.icon} filled className="text-base mt-0.5" />
                    <span className="flex-1 leading-snug">{t.message}</span>
                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      className="text-current opacity-60 hover:opacity-100"
                      aria-label="Đóng"
                    >
                      <Icon name="close" className="text-base" />
                    </button>
                  </div>
                )
              })}
            </>,
            target,
          )
        : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
