import { useEffect, useState } from 'react'
import { Button, Icon, Modal, useToast } from '../../components/ui'

/**
 * Hiển thị mật khẩu mới sau khi Admin reset cho 1 user.
 * Mật khẩu chỉ trả 1 lần từ backend — đóng modal là mất, không lưu lại.
 */
export function ResetPasswordResultModal({ open, result, onClose }) {
  const toast = useToast()
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setRevealed(false)
      setCopied(false)
    }
  }, [open])

  if (!open || !result) return null

  const password = result.newPassword
  const target = result.user

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      toast.success('Đã sao chép mật khẩu vào clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Trình duyệt không cho phép sao chép tự động.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mật khẩu mới"
      size="md"
      closeOnBackdrop={false}
      footer={
        <Button onClick={onClose}>
          <Icon name="check" className="text-[18px]" />
          Đã ghi nhận
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="text-sm text-on-surface-variant">
          Mật khẩu của <span className="font-semibold text-on-surface">{target.full_name}</span>{' '}
          (<span className="font-mono">{target.email}</span>) đã được đặt lại thành:
        </div>

        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
          <span className="flex-1 font-mono text-base tracking-wider text-on-surface select-all">
            {revealed ? password : '•'.repeat(password.length)}
          </span>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="p-2 text-outline hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
            title={revealed ? 'Ẩn' : 'Hiện'}
          >
            <Icon name={revealed ? 'visibility_off' : 'visibility'} className="text-[20px]" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 text-outline hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
            title="Sao chép"
          >
            <Icon name={copied ? 'check' : 'content_copy'} className="text-[20px]" />
          </button>
        </div>

        <div className="flex items-start gap-2 text-xs text-danger-500 bg-danger-50 border border-danger-500/30 rounded-lg px-3 py-2">
          <Icon name="warning" filled className="text-base mt-0.5 shrink-0" />
          <span>
            Hệ thống <strong>không lưu</strong> mật khẩu này. Hãy chuyển ngay cho người dùng
            qua kênh an toàn (Zalo/Slack/SMS). Khuyến nghị họ đổi lại sau lần đăng nhập đầu tiên.
          </span>
        </div>
      </div>
    </Modal>
  )
}
