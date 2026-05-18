import { useEffect, useState } from 'react'
import { Modal, Button, Icon } from '../ui'

/**
 * Modal nhập lý do khi PM trả về task ở 'Chờ đánh giá' về 'Đang làm'.
 * Reason bắt buộc (backend enforce). Frontend min 5 ký tự để đảm bảo PM viết tử tế.
 */
export function RejectReviewDialog({ open, taskTitle, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setReason('')
      setSubmitting(false)
      setError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (trimmed.length < 5) {
      setError('Vui lòng nhập lý do ít nhất 5 ký tự.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(trimmed)
    } catch (err) {
      setError(err.message || 'Không thực hiện được.')
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Trả về làm lại"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button variant="danger" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Icon name="undo" className="text-[18px]" />
                Trả về & gửi lý do
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="p-6 flex flex-col gap-3">
        <p className="text-sm text-on-surface-variant">
          Trả công việc <strong>"{taskTitle}"</strong> về cột "Đang làm". Lý do sẽ được tự
          động lưu thành 1 bình luận trên task để người phụ trách xem.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rj-reason" className="text-xs font-semibold text-on-surface">
            Lý do <span className="text-danger-500">*</span>
          </label>
          <textarea
            id="rj-reason"
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
            disabled={submitting}
            placeholder="Mô tả phần cần chỉnh sửa, làm lại..."
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container resize-none"
            maxLength={2000}
          />
          {error ? <span className="text-xs text-error">{error}</span> : null}
        </div>
      </div>
    </Modal>
  )
}
