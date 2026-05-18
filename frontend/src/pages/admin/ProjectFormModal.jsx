import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Icon, Spinner } from '../../components/ui'
import { useUsersQuery } from '../../hooks/useUsersQuery'

const emptyForm = {
  projectCode: '',
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  pmId: '',
}

// Backend trả start_date/end_date dạng ISO string (ví dụ '2026-05-07T00:00:00.000Z').
// <input type="date"> cần đúng 'YYYY-MM-DD' nên ta cắt phần đầu.
function toDateInput(value) {
  if (!value) return ''
  const s = String(value)
  return s.length >= 10 ? s.slice(0, 10) : ''
}

export function ProjectFormModal({ open, mode, initialProject, onClose, onSubmit }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // Lazy-load via React Query — mở/đóng modal nhiều lần không refetch trong staleTime.
  // `enabled` chỉ true khi modal open, để tránh fetch không cần thiết.
  const usersQuery = useUsersQuery()
  const usersLoading = usersQuery.isLoading && open
  const usersError = usersQuery.isError
    ? usersQuery.error?.message || 'Không tải được danh sách người dùng.'
    : null
  const users = useMemo(
    () => (usersQuery.data ?? []).filter((u) => u.status === 'Active'),
    [usersQuery.data],
  )

  // Reset form mỗi khi mở modal
  useEffect(() => {
    if (!open) return
    if (isEdit && initialProject) {
      setForm({
        projectCode: initialProject.project_code ?? '',
        name: initialProject.name ?? '',
        description: initialProject.description ?? '',
        startDate: toDateInput(initialProject.start_date),
        endDate: toDateInput(initialProject.end_date),
        pmId: initialProject.pm_id ?? '',
      })
    } else {
      setForm(emptyForm)
    }
    setTouched({})
    setServerError(null)
    setSubmitting(false)
  }, [open, isEdit, initialProject])


  const errors = {
    projectCode: !isEdit && !form.projectCode.trim() ? 'Vui lòng nhập mã dự án.' : null,
    name: !form.name.trim() ? 'Vui lòng nhập tên dự án.' : null,
    pmId: !form.pmId ? 'Vui lòng chọn người quản lý dự án.' : null,
    dateRange:
      form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)
        ? 'Ngày kết thúc không được trước ngày bắt đầu.'
        : null,
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
    setTouched({ projectCode: true, name: true, pmId: true, endDate: true })
    if (hasError) return

    setSubmitting(true)
    setServerError(null)
    try {
      await onSubmit({
        projectCode: form.projectCode.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        pmId: form.pmId,
      })
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

  const showCodeError = touched.projectCode && errors.projectCode
  const showNameError = touched.name && errors.name
  const showPmError = touched.pmId && errors.pmId
  const showDateError = touched.endDate && errors.dateRange

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isEdit ? 'Chỉnh sửa dự án' : 'Khởi tạo dự án mới'}
      size="lg"
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
              'Tạo dự án'
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="pf-code">
              Mã dự án <span className="text-danger-500">*</span>
            </label>
            <input
              id="pf-code"
              type="text"
              value={form.projectCode}
              onChange={setField('projectCode')}
              onBlur={markTouched('projectCode')}
              placeholder="VD: SWF-2026"
              disabled={submitting || isEdit}
              className={inputCls(showCodeError)}
            />
            {showCodeError ? (
              <span className="text-xs text-error">{errors.projectCode}</span>
            ) : isEdit ? (
              <span className="text-[11px] text-outline">Không thể đổi mã sau khi tạo.</span>
            ) : null}
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="pf-name">
              Tên dự án <span className="text-danger-500">*</span>
            </label>
            <input
              id="pf-name"
              type="text"
              value={form.name}
              onChange={setField('name')}
              onBlur={markTouched('name')}
              placeholder="Nhập tên dự án..."
              disabled={submitting}
              className={inputCls(showNameError)}
            />
            {showNameError ? <span className="text-xs text-error">{errors.name}</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="pf-desc">
            Mô tả
          </label>
          <textarea
            id="pf-desc"
            rows={3}
            value={form.description}
            onChange={setField('description')}
            placeholder="Mô tả mục tiêu, phạm vi của dự án..."
            disabled={submitting}
            className={`${inputCls(false)} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="pf-start">
              Ngày bắt đầu
            </label>
            <input
              id="pf-start"
              type="date"
              value={form.startDate}
              onChange={setField('startDate')}
              disabled={submitting}
              className={inputCls(false)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="pf-end">
              Ngày kết thúc
            </label>
            <input
              id="pf-end"
              type="date"
              value={form.endDate}
              onChange={setField('endDate')}
              onBlur={markTouched('endDate')}
              disabled={submitting}
              className={inputCls(showDateError)}
            />
            {showDateError ? <span className="text-xs text-error">{errors.dateRange}</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="pf-pm">
            Người quản lý dự án (PM) <span className="text-danger-500">*</span>
          </label>

          {usersLoading ? (
            <div className="px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50">
              <Spinner size="sm" label="Đang tải danh sách người dùng..." />
            </div>
          ) : usersError ? (
            <div className="px-3 py-2 border border-error-container rounded-lg bg-danger-50 text-error text-xs">
              {usersError}
            </div>
          ) : (
            <select
              id="pf-pm"
              value={form.pmId}
              onChange={setField('pmId')}
              onBlur={markTouched('pmId')}
              disabled={submitting}
              className={`${inputCls(showPmError)} bg-white`}
            >
              <option value="">-- Chọn PM --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} · {u.email}
                </option>
              ))}
            </select>
          )}

          {showPmError ? (
            <span className="text-xs text-error">{errors.pmId}</span>
          ) : (
            <span className="text-[11px] text-outline flex items-center gap-1">
              <Icon name="info" className="text-[14px]" />
              Chỉ tài khoản đang Hoạt động hiển thị trong danh sách. PM được chọn sẽ tự động trở
              thành thành viên dự án với vai trò MANAGER.
            </span>
          )}
        </div>
      </form>
    </Modal>
  )
}
