import { Modal } from './Modal'
import { Button } from './Button'
import { Icon } from './Icon'

/**
 * Hộp thoại xác nhận (Có / Hủy) với icon hint.
 * Props:
 *   open, onClose, onConfirm
 *   title, message
 *   tone: 'danger' | 'success' | 'warning' | 'info'
 *   confirmLabel, cancelLabel
 *   loading: bool
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Xác nhận',
  message,
  tone = 'warning',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  loading = false,
}) {
  const config = {
    danger: { icon: 'warning', wrap: 'bg-danger-50 text-danger-500', btn: 'danger' },
    success: { icon: 'check_circle', wrap: 'bg-success-50 text-success-600', btn: 'primary' },
    warning: { icon: 'warning', wrap: 'bg-tertiary-50 text-tertiary-700', btn: 'primary' },
    info: { icon: 'info', wrap: 'bg-primary-50 text-primary-700', btn: 'primary' },
  }[tone] ?? { icon: 'help', wrap: 'bg-neutral-100 text-neutral-700', btn: 'primary' }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={config.btn} onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang xử lý...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </>
      }
    >
      <div className="px-6 py-6 flex flex-col items-center text-center">
        <div className={`w-12 h-12 rounded-full ${config.wrap} flex items-center justify-center mb-4`}>
          <Icon name={config.icon} filled className="text-[24px]" />
        </div>
        <p className="text-sm text-on-surface-variant whitespace-pre-line">{message}</p>
      </div>
    </Modal>
  )
}
