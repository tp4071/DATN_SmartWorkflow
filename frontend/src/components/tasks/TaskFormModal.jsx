import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Icon, Spinner } from '../ui'
import { useProjectMembersQuery } from '../../hooks/useProjectQueries'

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
]

const emptyForm = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  estimateHours: '',
  dueDate: '',
  assigneeId: '',
}

function toDateInput(value) {
  if (!value) return ''
  const s = String(value)
  return s.length >= 10 ? s.slice(0, 10) : ''
}

/**
 * Reusable modal cho cả tạo task (PM) và đề xuất task (Member).
 *
 * Props:
 *   open, onClose
 *   mode: 'create' | 'propose'
 *   projectId (UUID)
 *   project: { start_date, end_date } — để validate due_date trong khung dự án
 *   onSubmit({ title, description, priority, estimateHours, dueDate, assigneeId }) -> Promise
 *
 * Khác biệt UI giữa 2 mode:
 *   - 'create' (PM): hiện dropdown chọn assignee từ thành viên dự án
 *   - 'propose' (Member): KHÔNG hiện assignee (PM sẽ gán sau), submit không gửi assignee_id
 */
export function TaskFormModal({ open, onClose, mode = 'create', projectId, project, onSubmit }) {
  const isPropose = mode === 'propose'

  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)

  // Load members chỉ khi mode='create' (PM cần chọn assignee).
  // React Query cache theo projectId — mở/đóng modal nhiều lần không refetch.
  const membersQuery = useProjectMembersQuery(open && !isPropose ? projectId : null)
  const members = useMemo(
    () => (membersQuery.data ?? []).filter((m) => m.status === 'Active'),
    [membersQuery.data],
  )
  const membersLoading = membersQuery.isLoading
  const membersError = membersQuery.isError
    ? membersQuery.error?.message || 'Không tải được danh sách thành viên.'
    : null

  // Reset state mỗi khi mở
  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setTouched({})
    setSubmitting(false)
    setServerError(null)
  }, [open])

  // Validate
  const projectStart = useMemo(() => toDateInput(project?.start_date), [project])
  const projectEnd = useMemo(() => toDateInput(project?.end_date), [project])

  const errors = {
    title: !form.title.trim()
      ? 'Vui lòng nhập tiêu đề.'
      : form.title.trim().length > 200
        ? 'Tiêu đề tối đa 200 ký tự.'
        : null,
    estimateHours:
      form.estimateHours !== '' && (Number.isNaN(Number(form.estimateHours)) || Number(form.estimateHours) < 0)
        ? 'Số giờ phải là số không âm.'
        : null,
    dueDate: (() => {
      if (!form.dueDate) return null
      if (projectStart && form.dueDate < projectStart) {
        return `Hạn không được trước ngày bắt đầu dự án (${projectStart}).`
      }
      if (projectEnd && form.dueDate > projectEnd) {
        return `Hạn không được sau ngày kết thúc dự án (${projectEnd}).`
      }
      return null
    })(),
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
    setTouched({ title: true, estimateHours: true, dueDate: true })
    if (hasError) return

    setSubmitting(true)
    setServerError(null)
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        estimateHours: form.estimateHours,
        dueDate: form.dueDate || null,
        // Member propose: KHÔNG gửi assignee_id (PM sẽ gán sau)
        assigneeId: isPropose ? null : form.assigneeId || null,
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

  const showTitleError = touched.title && errors.title
  const showEstimateError = touched.estimateHours && errors.estimateHours
  const showDateError = touched.dueDate && errors.dueDate

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={isPropose ? 'Đề xuất công việc mới' : 'Thêm công việc'}
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
                {isPropose ? 'Đang gửi...' : 'Đang lưu...'}
              </>
            ) : isPropose ? (
              'Gửi đề xuất'
            ) : (
              'Tạo công việc'
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

        {isPropose ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-100 text-primary-900 text-xs">
            <Icon name="info" filled className="text-base mt-0.5 text-primary-700" />
            <span>
              Đề xuất sẽ được PM xét duyệt trước khi xuất hiện trên bảng công việc. PM sẽ gán
              người phụ trách khi phê duyệt.
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="tf-title">
            Tiêu đề <span className="text-danger-500">*</span>
          </label>
          <input
            id="tf-title"
            type="text"
            value={form.title}
            onChange={setField('title')}
            onBlur={markTouched('title')}
            placeholder="VD: Thiết kế trang đăng nhập"
            disabled={submitting}
            className={inputCls(showTitleError)}
            maxLength={250}
          />
          {showTitleError ? <span className="text-xs text-error">{errors.title}</span> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-on-surface" htmlFor="tf-desc">
            Mô tả
          </label>
          <textarea
            id="tf-desc"
            rows={3}
            value={form.description}
            onChange={setField('description')}
            placeholder="Mô tả chi tiết yêu cầu, ràng buộc..."
            disabled={submitting}
            className={`${inputCls(false)} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="tf-priority">
              Mức ưu tiên
            </label>
            <select
              id="tf-priority"
              value={form.priority}
              onChange={setField('priority')}
              disabled={submitting}
              className={`${inputCls(false)} bg-white`}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="tf-estimate">
              Số giờ ước tính
            </label>
            <input
              id="tf-estimate"
              type="number"
              min="0"
              step="0.5"
              value={form.estimateHours}
              onChange={setField('estimateHours')}
              onBlur={markTouched('estimateHours')}
              placeholder="VD: 4"
              disabled={submitting}
              className={inputCls(showEstimateError)}
            />
            {showEstimateError ? (
              <span className="text-xs text-error">{errors.estimateHours}</span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="tf-due">
              Hạn hoàn thành
            </label>
            <input
              id="tf-due"
              type="date"
              value={form.dueDate}
              onChange={setField('dueDate')}
              onBlur={markTouched('dueDate')}
              min={projectStart || undefined}
              max={projectEnd || undefined}
              disabled={submitting}
              className={inputCls(showDateError)}
            />
            {showDateError ? <span className="text-xs text-error">{errors.dueDate}</span> : null}
          </div>
        </div>

        {!isPropose ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface" htmlFor="tf-assignee">
              Người phụ trách
            </label>
            {membersLoading ? (
              <div className="px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50">
                <Spinner size="sm" label="Đang tải..." />
              </div>
            ) : membersError ? (
              <div className="px-3 py-2 border border-error-container rounded-lg bg-danger-50 text-error text-xs">
                {membersError}
              </div>
            ) : (
              <select
                id="tf-assignee"
                value={form.assigneeId}
                onChange={setField('assigneeId')}
                disabled={submitting}
                className={`${inputCls(false)} bg-white`}
              >
                <option value="">— Chưa phân công —</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} · {m.email}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[11px] text-outline">
              Chỉ thành viên của dự án (status Active) hiển thị trong danh sách.
            </span>
          </div>
        ) : null}
      </form>
    </Modal>
  )
}
