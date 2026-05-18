import { useEffect, useState } from 'react'
import { Modal, Button, Icon } from '../../components/ui'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ROLE_OPTIONS = [
  { value: 'USER', label: 'Người dùng (USER)' },
  { value: 'ADMIN', label: 'Quản trị viên (ADMIN)' },
]

const emptyForm = { fullName: '', email: '', password: '', systemRole: 'USER' }

export function UserFormModal({ open, mode, initialUser, onClose, onSubmit }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // Reset state mỗi khi mở modal hoặc đổi user đang edit
  useEffect(() => {
    if (!open) return
    if (isEdit && initialUser) {
      setForm({
        fullName: initialUser.full_name ?? '',
        email: initialUser.email ?? '',
        password: '',
        systemRole: initialUser.system_role ?? 'USER',
      })
    } else {
      setForm(emptyForm)
    }
    setTouched({})
    setServerError(null)
    setSubmitting(false)
  }, [open, isEdit, initialUser])

  const errors = {
    fullName: !form.fullName.trim() ? 'Vui lòng nhập họ tên.' : null,
    email: !form.email.trim()
      ? 'Vui lòng nhập email.'
      : !EMAIL_REGEX.test(form.email.trim())
        ? 'Email không đúng định dạng.'
        : null,
    password: isEdit
      ? null
      : !form.password
        ? 'Vui lòng nhập mật khẩu khởi tạo.'
        : form.password.length < 6
          ? 'Mật khẩu tối thiểu 6 ký tự.'
          : null,
    systemRole: !['ADMIN', 'USER'].includes(form.systemRole) ? 'Vai trò không hợp lệ.' : null,
  }
  const hasError = Object.values(errors).some(Boolean)

  const setField = (key) => (e) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setServerError(null)
  }
  const markTouched = (key) => () => setTouched((t) => ({ ...t, [key]: true }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ fullName: true, email: true, password: true, systemRole: true })
    if (hasError) return

    setSubmitting(true)
    setServerError(null)
    try {
      await onSubmit({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        systemRole: form.systemRole,
      })
      // Cha sẽ gọi onClose sau khi thành công
    } catch (err) {
      setServerError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.')
      setSubmitting(false)
    }
  }

  const inputCls = (invalid) =>
    `w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
      invalid
        ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
        : 'border-neutral-200 focus:border-primary-container focus:ring-1 focus:ring-primary-container'
    } disabled:bg-neutral-50 disabled:text-outline`

  const showFullNameError = touched.fullName && errors.fullName
  const showEmailError = touched.email && errors.email
  const showPasswordError = touched.password && errors.password

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang lưu...
              </>
            ) : isEdit ? (
              'Lưu thay đổi'
            ) : (
              'Thêm nhân sự'
            )}
          </Button>
        </>
      }
    >
      <form className="p-6 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
          >
            <Icon name="error" filled className="text-base mt-0.5" />
            <span className="flex-1">{serverError}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="uf-name">
            Họ và tên <span className="text-danger-500">*</span>
          </label>
          <input
            id="uf-name"
            type="text"
            value={form.fullName}
            onChange={setField('fullName')}
            onBlur={markTouched('fullName')}
            placeholder="Nhập họ và tên..."
            disabled={submitting}
            className={inputCls(showFullNameError)}
          />
          {showFullNameError ? (
            <span className="text-xs text-error">{errors.fullName}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="uf-email">
            Email <span className="text-danger-500">*</span>
          </label>
          <input
            id="uf-email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            onBlur={markTouched('email')}
            placeholder="example@university.edu.vn"
            autoComplete="off"
            disabled={submitting}
            className={inputCls(showEmailError)}
          />
          {showEmailError ? <span className="text-xs text-error">{errors.email}</span> : null}
        </div>

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="uf-password">
              Mật khẩu khởi tạo <span className="text-danger-500">*</span>
            </label>
            <input
              id="uf-password"
              type="password"
              value={form.password}
              onChange={setField('password')}
              onBlur={markTouched('password')}
              placeholder="Tối thiểu 6 ký tự"
              autoComplete="new-password"
              disabled={submitting}
              className={inputCls(showPasswordError)}
            />
            {showPasswordError ? (
              <span className="text-xs text-error">{errors.password}</span>
            ) : (
              <span className="text-[11px] text-outline">
                Người dùng sẽ đăng nhập lần đầu bằng mật khẩu này.
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="uf-role">
            Vai trò hệ thống <span className="text-danger-500">*</span>
          </label>
          <select
            id="uf-role"
            value={form.systemRole}
            onChange={setField('systemRole')}
            disabled={submitting}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container disabled:bg-neutral-50"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-outline">
            ADMIN có toàn quyền hệ thống. USER là người dùng thường, vai trò trong từng dự án sẽ
            được PM gán riêng.
          </span>
        </div>
      </form>
    </Modal>
  )
}
