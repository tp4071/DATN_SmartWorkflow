import { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Button,
  Icon,
  Avatar,
  Spinner,
  Pill,
  PriorityBadge,
  useToast,
} from '../ui'
import { useAuth } from '../../context/useAuth'
import { listProjectMembers } from '../../services/projectMembers.api'
import {
  acceptReviewTask,
  getTaskDetail,
  rejectReviewTask,
  startProgressTask,
  submitReviewTask,
  updateTask,
} from '../../services/tasks.api'
import { AttachmentsSection } from './AttachmentsSection'
import { CommentsSection } from './CommentsSection'
import { RejectReviewDialog } from './RejectReviewDialog'

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
]

const STATUS_TONE = {
  'Chờ duyệt': 'info',
  'Cần làm': 'neutral',
  'Đang làm': 'primary',
  'Chờ đánh giá': 'warning',
  'Hoàn thành': 'success',
}

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toDateInput(value) {
  if (!value) return ''
  const s = String(value)
  return s.length >= 10 ? s.slice(0, 10) : ''
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Modal xem + chỉnh sửa chi tiết task. Tích hợp:
 *  - UC09: edit thông tin chi tiết
 *  - UC10: nút "Bắt đầu làm" (Cần làm → Đang làm)
 *  - UC11: nút "Gửi nghiệm thu" (Đang làm → Chờ đánh giá), bắt buộc ≥ 1 attachment
 *  - UC12: nút "Phê duyệt" / "Trả về làm lại" (Chờ đánh giá → Hoàn thành/Đang làm)
 *  - Đính kèm (UC11 prerequisite)
 *  - Bình luận (UC13)
 */
export function TaskDetailModal({
  open,
  projectId,
  taskId,
  project,
  canManage,
  readOnly = false,
  onClose,
  onSaved,
}) {
  const { user } = useAuth()
  const toast = useToast()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const [members, setMembers] = useState([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [touched, setTouched] = useState({})

  const [workflowBusy, setWorkflowBusy] = useState(null) // 'start' | 'submit' | 'accept' | 'reject' | null
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  // Fetch chi tiết khi mở
  useEffect(() => {
    if (!open || !taskId || !projectId) return undefined
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setEditMode(false)
    setServerError(null)
    setTouched({})
    setMembers([])
    setMembersLoaded(false)
    getTaskDetail(projectId, taskId)
      .then((data) => {
        if (cancelled) return
        setTask(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || 'Không tải được công việc.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, taskId, projectId])

  useEffect(() => {
    // Load members ngay khi mở modal (cần cho cả assignee picker khi edit
    // lẫn @mention picker trong CommentsSection).
    if (!open || membersLoaded || !projectId) return undefined
    let cancelled = false
    listProjectMembers(projectId)
      .then((list) => {
        if (cancelled) return
        setMembers((list || []).filter((m) => m.status === 'Active'))
        setMembersLoaded(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, membersLoaded, projectId])

  const isAssignee = task?.assignee_id && task.assignee_id === user?.id
  const canEdit = canManage || isAssignee
  const isLockedStatus =
    task?.status === 'Chờ đánh giá' || task?.status === 'Hoàn thành'

  /* ============ Workflow actions ============ */

  const refreshTask = async () => {
    try {
      const fresh = await getTaskDetail(projectId, taskId)
      setTask(fresh)
      onSaved?.(fresh)
    } catch {
      // bỏ qua
    }
  }

  const runWorkflow = async (kind, fn) => {
    setWorkflowBusy(kind)
    try {
      await fn()
      await refreshTask()
    } catch (err) {
      toast.error(err.message || 'Không thực hiện được thao tác.')
    } finally {
      setWorkflowBusy(null)
    }
  }

  const handleStartProgress = () =>
    runWorkflow('start', async () => {
      await startProgressTask(projectId, taskId)
      toast.success('Đã chuyển sang "Đang làm"')
    })

  const handleSubmitReview = () => {
    if ((task?.attachments?.length ?? 0) === 0) {
      toast.error('Cần ít nhất 1 tài liệu đính kèm trước khi gửi nghiệm thu.')
      return
    }
    if (!window.confirm('Sau khi gửi nghiệm thu, bạn sẽ KHÔNG thể tự đổi trạng thái task này. Tiếp tục?')) {
      return
    }
    runWorkflow('submit', async () => {
      await submitReviewTask(projectId, taskId)
      toast.success('Đã gửi nghiệm thu, chờ PM phê duyệt')
    })
  }

  const handleAcceptReview = () =>
    runWorkflow('accept', async () => {
      await acceptReviewTask(projectId, taskId)
      toast.success('Đã phê duyệt nghiệm thu, task chuyển "Hoàn thành"')
    })

  const handleRejectReview = async (reason) => {
    setWorkflowBusy('reject')
    try {
      await rejectReviewTask(projectId, taskId, reason)
      toast.success('Đã trả về làm lại, lý do đã được lưu vào bình luận')
      setRejectDialogOpen(false)
      await refreshTask()
    } catch (err) {
      toast.error(err.message || 'Không thực hiện được.')
      throw err
    } finally {
      setWorkflowBusy(null)
    }
  }

  /* ============ Edit form ============ */

  const enterEdit = () => {
    if (!task) return
    setForm({
      title: task.title ?? '',
      description: task.description ?? '',
      priority: task.priority ?? 'MEDIUM',
      estimateHours: task.estimate_hours ?? '',
      dueDate: toDateInput(task.due_date),
      assigneeId: task.assignee_id ?? '',
    })
    setTouched({})
    setServerError(null)
    setEditMode(true)
  }
  const cancelEdit = () => {
    setEditMode(false)
    setServerError(null)
  }

  const projectStart = useMemo(() => toDateInput(project?.start_date), [project])
  const projectEnd = useMemo(() => toDateInput(project?.end_date), [project])

  const errors = useMemo(() => {
    if (!form) return {}
    return {
      title: !form.title.trim()
        ? 'Tiêu đề bắt buộc.'
        : form.title.trim().length > 200
          ? 'Tiêu đề tối đa 200 ký tự.'
          : null,
      estimateHours:
        form.estimateHours !== '' &&
        form.estimateHours !== null &&
        (Number.isNaN(Number(form.estimateHours)) || Number(form.estimateHours) < 0)
          ? 'Số giờ phải là số không âm.'
          : null,
      dueDate: (() => {
        if (!form.dueDate) return null
        if (projectStart && form.dueDate < projectStart)
          return `Hạn không được trước ${projectStart}.`
        if (projectEnd && form.dueDate > projectEnd)
          return `Hạn không được sau ${projectEnd}.`
        return null
      })(),
    }
  }, [form, projectStart, projectEnd])

  const hasError = Object.values(errors).some(Boolean)

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setServerError(null)
  }
  const markTouched = (key) => () => setTouched((t) => ({ ...t, [key]: true }))

  const handleSave = async () => {
    setTouched({ title: true, estimateHours: true, dueDate: true })
    if (hasError) return
    setSubmitting(true)
    setServerError(null)
    try {
      await updateTask(projectId, taskId, {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        estimateHours: form.estimateHours,
        dueDate: form.dueDate || null,
        assigneeId: form.assigneeId || null,
      })
      setEditMode(false)
      await refreshTask()
    } catch (err) {
      setServerError(err.message || 'Không cập nhật được công việc.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = (invalid) =>
    `w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
      invalid
        ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
        : 'border-neutral-200 focus:border-primary-container focus:ring-1 focus:ring-primary-container'
    } disabled:bg-neutral-50 disabled:text-outline`

  /* ============ Footer ============ */

  let footer = null
  if (editMode) {
    footer = (
      <>
        <Button variant="ghost" onClick={cancelEdit} disabled={submitting}>
          Hủy
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={submitting}>
          {submitting ? (
            <>
              <Icon name="progress_activity" className="text-sm spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Icon name="save" className="text-[18px]" />
              Lưu thay đổi
            </>
          )}
        </Button>
      </>
    )
  } else if (canEdit && !isLockedStatus) {
    footer = (
      <>
        <Button variant="ghost" onClick={onClose}>
          Đóng
        </Button>
        <Button onClick={enterEdit}>
          <Icon name="edit" className="text-[18px]" />
          Chỉnh sửa
        </Button>
      </>
    )
  } else {
    footer = (
      <Button variant="ghost" onClick={onClose}>
        Đóng
      </Button>
    )
  }

  /* ============ Workflow action bar ============ */

  const renderWorkflowBar = () => {
    if (!task || editMode) return null
    const busy = workflowBusy !== null

    if (task.status === 'Cần làm' && (canManage || isAssignee)) {
      return (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-100">
          <div className="text-xs text-primary-900 flex items-center gap-2">
            <Icon name="play_arrow" filled className="text-base" />
            Sẵn sàng bắt đầu công việc này.
          </div>
          <Button size="sm" onClick={handleStartProgress} disabled={busy}>
            {workflowBusy === 'start' ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Icon name="play_arrow" className="text-[16px]" />
                Bắt đầu làm
              </>
            )}
          </Button>
        </div>
      )
    }

    if (task.status === 'Đang làm' && isAssignee) {
      const hasAttachment = (task.attachments?.length ?? 0) > 0
      return (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-tertiary-50 border border-tertiary-300">
          <div className="text-xs text-tertiary-700 flex items-center gap-2">
            <Icon name="fact_check" filled className="text-base" />
            {hasAttachment
              ? 'Bạn có thể gửi nghiệm thu cho PM xét duyệt.'
              : 'Cần đính kèm ≥ 1 tài liệu trước khi gửi nghiệm thu.'}
          </div>
          <Button size="sm" onClick={handleSubmitReview} disabled={busy || !hasAttachment}>
            {workflowBusy === 'submit' ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Icon name="fact_check" className="text-[16px]" />
                Gửi nghiệm thu
              </>
            )}
          </Button>
        </div>
      )
    }

    if (task.status === 'Chờ đánh giá' && canManage) {
      return (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-tertiary-50 border border-tertiary-300">
          <div className="text-xs text-tertiary-700 flex items-center gap-2">
            <Icon name="rate_review" filled className="text-base" />
            Member đã gửi nghiệm thu — bạn cần xét duyệt.
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => setRejectDialogOpen(true)}
              disabled={busy}
            >
              <Icon name="undo" className="text-[16px]" />
              Trả về
            </Button>
            <Button size="sm" onClick={handleAcceptReview} disabled={busy}>
              {workflowBusy === 'accept' ? (
                <>
                  <Icon name="progress_activity" className="text-sm spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Icon name="check" className="text-[16px]" />
                  Phê duyệt
                </>
              )}
            </Button>
          </div>
        </div>
      )
    }

    if (task.status === 'Hoàn thành') {
      return (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success-50 border border-success-600/20 text-success-600 text-xs">
          <Icon name="task_alt" filled className="text-base" />
          Công việc đã hoàn thành và được nghiệm thu.
        </div>
      )
    }

    return null
  }

  return (
    <Modal
      open={open}
      onClose={submitting || workflowBusy ? () => {} : onClose}
      title="Chi tiết công việc"
      size="lg"
      footer={footer}
    >
      {loading ? (
        <div className="px-6 py-12 flex justify-center">
          <Spinner size="lg" label="Đang tải chi tiết..." />
        </div>
      ) : loadError ? (
        <div className="px-6 py-10 text-center">
          <Icon name="error" className="text-3xl text-danger-500 mb-2" />
          <p className="text-sm text-error">{loadError}</p>
        </div>
      ) : task ? (
        <div className="p-6 flex flex-col gap-5">
          {/* Header: title + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {editMode ? (
                <input
                  type="text"
                  value={form.title}
                  onChange={setField('title')}
                  onBlur={markTouched('title')}
                  className={`${inputCls(touched.title && errors.title)} text-lg font-semibold`}
                  maxLength={250}
                />
              ) : (
                <h3 className="text-h2 font-h2 text-on-surface break-words">{task.title}</h3>
              )}
              {touched.title && errors.title ? (
                <span className="text-xs text-error">{errors.title}</span>
              ) : null}
            </div>
            <Pill tone={STATUS_TONE[task.status] ?? 'neutral'}>{task.status}</Pill>
          </div>

          {/* Chip vai trò — giúp user biết quyền của mình trong dự án này.
              Cùng 1 user có thể là PM ở dự án này, MEMBER ở dự án khác. */}
          {!editMode && (canManage || isAssignee) ? (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {canManage ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-primary-50 text-primary-900 border-primary-100 font-semibold">
                  <Icon name="manage_accounts" className="text-[14px]" />
                  Bạn là Quản lý dự án
                </span>
              ) : null}
              {isAssignee ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-success-50 text-success-600 border-success-600/30 font-semibold">
                  <Icon name="person" className="text-[14px]" />
                  Bạn là người phụ trách
                </span>
              ) : null}
            </div>
          ) : null}

          {renderWorkflowBar()}

          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm"
            >
              <Icon name="error" filled className="text-base mt-0.5" />
              <span className="flex-1">{serverError}</span>
            </div>
          ) : null}

          {!editMode && !canEdit ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs">
              <Icon name="visibility" className="text-base mt-0.5" />
              <span>Chế độ chỉ đọc — chỉ Quản lý dự án hoặc người phụ trách mới được sửa.</span>
            </div>
          ) : null}

          {!editMode && canEdit && isLockedStatus ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-tertiary-50 border border-tertiary-300 text-tertiary-700 text-xs">
              <Icon name="lock" className="text-base mt-0.5" />
              <span>
                Task đang ở trạng thái "{task.status}" — không thể chỉnh sửa thông tin chi tiết.
                {task.status === 'Chờ đánh giá' ? ' PM cần Trả về làm lại trước.' : ''}
              </span>
            </div>
          ) : null}

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Mô tả
            </label>
            {editMode ? (
              <textarea
                rows={4}
                value={form.description}
                onChange={setField('description')}
                disabled={submitting}
                className={`${inputCls(false)} resize-none`}
                placeholder="Mô tả chi tiết yêu cầu, ràng buộc..."
              />
            ) : task.description ? (
              <p className="text-sm text-on-surface whitespace-pre-line bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-outline italic">Không có mô tả.</p>
            )}
          </div>

          {/* Grid: priority / estimate / due */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Mức ưu tiên
              </label>
              {editMode ? (
                <select
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
              ) : (
                <PriorityBadge priority={task.priority} />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Ước tính (giờ)
              </label>
              {editMode ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.estimateHours ?? ''}
                    onChange={setField('estimateHours')}
                    onBlur={markTouched('estimateHours')}
                    disabled={submitting}
                    className={inputCls(touched.estimateHours && errors.estimateHours)}
                  />
                  {touched.estimateHours && errors.estimateHours ? (
                    <span className="text-xs text-error">{errors.estimateHours}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-on-surface">
                  {task.estimate_hours ? `${task.estimate_hours} giờ` : <span className="text-outline italic">—</span>}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Hạn hoàn thành
              </label>
              {editMode ? (
                <>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={setField('dueDate')}
                    onBlur={markTouched('dueDate')}
                    min={projectStart || undefined}
                    max={projectEnd || undefined}
                    disabled={submitting}
                    className={inputCls(touched.dueDate && errors.dueDate)}
                  />
                  {touched.dueDate && errors.dueDate ? (
                    <span className="text-xs text-error">{errors.dueDate}</span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-on-surface">
                  {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : (
                    <span className="text-outline italic">Chưa đặt</span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Người phụ trách
            </label>
            {editMode && canManage ? (
              <select
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
            ) : task.assignee ? (
              <div className="flex items-center gap-2">
                <Avatar initials={makeInitials(task.assignee.full_name)} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {task.assignee.full_name}
                  </div>
                  <div className="text-xs text-on-surface-variant truncate">
                    {task.assignee.email}
                  </div>
                </div>
              </div>
            ) : task.assignee_name ? (
              <div className="flex items-center gap-2">
                <Avatar initials={makeInitials(task.assignee_name)} size="sm" />
                <span className="text-sm text-on-surface">{task.assignee_name}</span>
              </div>
            ) : (
              <span className="text-sm text-outline italic">Chưa phân công</span>
            )}
            {editMode && !canManage ? (
              <span className="text-[11px] text-outline">
                Chỉ Quản lý dự án mới được đổi người phụ trách.
              </span>
            ) : null}
          </div>

          {/* Meta */}
          <div className="border-t border-neutral-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-on-surface-variant">
            <div>
              <span className="text-outline">Người tạo: </span>
              <span className="text-on-surface">
                {task.creator_name ?? <span className="italic text-outline">Không xác định</span>}
              </span>
            </div>
            <div>
              <span className="text-outline">Tạo lúc: </span>
              <span className="text-on-surface">{formatDateTime(task.created_at)}</span>
            </div>
            <div>
              <span className="text-outline">Cập nhật cuối: </span>
              <span className="text-on-surface">{formatDateTime(task.updated_at)}</span>
            </div>
          </div>

          {/* Attachments */}
          {!editMode ? (
            <div className="border-t border-neutral-200 pt-4">
              <AttachmentsSection
                projectId={projectId}
                taskId={taskId}
                items={task.attachments ?? []}
                currentUserId={user?.id}
                canManage={canManage}
                readOnly={readOnly}
                onChange={(updated) => setTask((t) => ({ ...t, attachments: updated }))}
              />
            </div>
          ) : null}

          {/* Comments */}
          {!editMode ? (
            <div className="border-t border-neutral-200 pt-4">
              <CommentsSection
                projectId={projectId}
                taskId={taskId}
                items={task.comments ?? []}
                currentUserId={user?.id}
                canManage={canManage}
                readOnly={readOnly}
                members={members}
                onChange={(updated) => setTask((t) => ({ ...t, comments: updated }))}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <RejectReviewDialog
        open={rejectDialogOpen}
        taskTitle={task?.title ?? ''}
        onClose={() => (workflowBusy === 'reject' ? null : setRejectDialogOpen(false))}
        onConfirm={handleRejectReview}
      />
    </Modal>
  )
}
