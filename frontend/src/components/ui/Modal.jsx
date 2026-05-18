import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/**
 * Modal cơ bản: render vào #modal-root, đóng khi nhấn ESC hoặc click backdrop.
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: string
 *   size: 'sm' | 'md' | 'lg' (mặc định 'md')
 *   footer: ReactNode (đặt ở phần action bar)
 *   children: ReactNode (nội dung)
 *   closeOnBackdrop: boolean (mặc định true)
 */
export function Modal({
  open,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const widthCls =
    size === 'sm' ? 'max-w-[400px]' : size === 'lg' ? 'max-w-[720px]' : 'max-w-[520px]'

  const node = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 fade-in">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white w-full ${widthCls} rounded-xl shadow-xl flex flex-col overflow-hidden modal-anim max-h-[90vh]`}
      >
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-25">
          <h2 id="modal-title" className="text-h2 font-h2 text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:bg-neutral-100 p-1 rounded-full transition-colors"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
        {footer ? (
          <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-25 flex justify-end gap-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )

  const target = document.getElementById('modal-root') ?? document.body
  return createPortal(node, target)
}
