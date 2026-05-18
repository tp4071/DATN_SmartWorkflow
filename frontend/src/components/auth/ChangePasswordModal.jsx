import { useEffect, useState } from 'react'
import { Modal, Button, Icon, useToast } from '../ui'
import { changeMyPassword } from '../../services/me.api'

const MIN_LEN = 6

const emptyForm = {
  current: '',
  next: '',
  confirm: '',
}

/**
 * Modal đổi mật khẩu cho user hiện tại.
 *
 * Bảo mật cơ bản:
 *   - 3 input đều type=password, có nút show/hide riêng từng trường.
 *   - Validate client (giống backend): currentRequired, next ≥ 6, next != current,
 *     confirm phải khớp next.
 *   - Khi backend trả 400 "Mật khẩu hiện tại không đúng" → hiển thị inline tại field
 *     current để user biết chính xác lỗi ở đâu.
 *
 * Lưu ý: hệ thống dùng JWT stateless, đổi mật khẩu KHÔNG đăng xuất các phiên cũ.
 * Nếu user nghi ngờ bị lộ session, vẫn nên đăng xuất sau khi đổi.
 */
export function ChangePasswordModal({ open, onClose, onSuccess }) {
  const toast = useToast()
  const [form, setForm] = useState(emptyForm)
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(emptyForm)
      setShow({ current: false, next: false, confirm: false })
      setTouched({})
      setServerError(null)
      setSubmitting(false)
    }
  }, [open])

  const errors = {
    current: !form.current ? 'Vui lòng nhập mật khẩu hiện tại.' : null,
    next: !form.next
      ? 'Vui lòng nhập mật khẩu mới.'
      : form.next.length < MIN_LEN
        ? `Mật khẩu mới phải tối thiểu ${MIN_LEN} ký tự.`
        : form.next === form.current
          ? 'Mật khẩu mới phải khác mật khẩu hiện tại.'
          : null,
    confirm: !form.confirm
      ? 'Vui lòng nhập lại mật khẩu mới.'
      : form.confirm !== form.next
        ? 'Hai mật khẩu không khớp.'
        : null,
  }
  const hasError = Object.values(errors).some(Boolean)

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setServerError(null)
  }
  const markTouched = (key) => () => setTouched((t) => ({ ...t, [key]: true }))
  const toggleShow = (key) => () => setShow((s) => ({ ...s, [key]: !s[key] }))

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setTouched({ current: true, next: true, confirm: true })
    if (hasError) return

    setSubmitting(true)
    setServerError(null)
    try {
      await changeMyPassword({
        currentPassword: form.current,
        newPassword: form.next,
      })
      toast.success('Đã đổi mật khẩu thành công')
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setServerError(err.message || 'Không đổi được mật khẩu.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (invalid) =>
    `w-full h-10 px-3 pr-10 border rounded-lg text-sm outline-none transition-colors ${
      invalid
        ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
        : 'border-neutral-200 focus:border-primary-container focus:ring-1 focus:ring-primary-container'
    } disabled:bg-neutral-50 disabled:text-outline`

  const renderField = (key, label, autocomplete) => {
    const showError = touched[key] && errors[key]
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-on-surface" htmlFor={`cp-${key}`}>
          {label} <span className="text-danger-500">*</span>
        </label>
        <div className="relative">
          <input
            id={`cp-${key}`}
            type={show[key] ? 'text' : 'password'}
            autoComplete={autocomplete}
            value={form[key]}
            onChange={setField(key)}
            onBlur={markTouched(key)}
            disabled={submitting}
            className={inputCls(showError)}
          />
          <button
            type="button"
            onClick={toggleShow(key)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-neutral-700 rounded"
            tabIndex={-1}
            aria-label={show[key] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <Icon name={show[key] ? 'visibility' : 'visibility_off'} className="text-base" />
          </button>
        </div>
        {showError ? <span className="text-xs text-error">{errors[key]}</span> : null}
      </div>
    )
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Đổi mật khẩu"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang đổi...
              </>
            ) : (
              <>
                <Icon name="lock_reset" className="text-[18px]" />
                Đổi mật khẩu
              </>
            )}
          </Button>
        </>
      }
    >
      <form className="p-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
          >
            <Icon name="error" filled className="text-base mt-0.5" />
            <span className="flex-1">{serverError}</span>
          </div>
        ) : null}

        {renderField('current', 'Mật khẩu hiện tại', 'current-password')}
        {renderField('next', 'Mật khẩu mới', 'new-password')}
        {renderField('confirm', 'Nhập lại mật khẩu mới', 'new-password')}

        <div className="text-[11px] text-outline flex items-start gap-1.5 -mt-1">
          <Icon name="info" className="text-[14px] mt-0.5" />
          <span>
            Tối thiểu {MIN_LEN} ký tự. Sau khi đổi, các thiết bị đã đăng nhập trước đó vẫn
            có thể tiếp tục dùng cho đến khi token hết hạn (24h).
          </span>
        </div>
      </form>
    </Modal>
  )
}
