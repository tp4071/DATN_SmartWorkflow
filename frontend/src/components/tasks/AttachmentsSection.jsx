import { useRef, useState } from 'react'
import { Button, Icon, ConfirmDialog } from '../ui'
import {
  addAttachment,
  deleteAttachment,
  uploadAttachment,
} from '../../services/taskAttachments.api'

const URL_REGEX = /^https?:\/\/[^\s]+$/i
const MAX_SIZE_MB = 10

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Section đính kèm trong TaskDetailModal.
 *
 * 2 cách thêm file:
 *  1. Tải lên: chọn file từ máy → backend upload lên Supabase Storage (≤ 10MB).
 *  2. Dán URL: nhập tên + link http(s) bất kỳ (Drive, Dropbox, …).
 *
 * Quyền xóa: người upload hoặc PM/Admin.
 */
export function AttachmentsSection({
  projectId,
  taskId,
  items = [],
  currentUserId,
  canManage,
  readOnly = false,
  onChange,
}) {
  const fileInputRef = useRef(null)
  const [showUrlForm, setShowUrlForm] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Upload progress (XHR onprogress)
  const [uploadingName, setUploadingName] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const [confirmDelete, setConfirmDelete] = useState({ open: false, attachment: null, busy: false })

  const resetUrlForm = () => {
    setFileName('')
    setFileUrl('')
    setError(null)
    setShowUrlForm(false)
  }

  const handlePickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng file
    if (!file) return
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File vượt quá ${MAX_SIZE_MB}MB.`)
      return
    }

    setError(null)
    setUploadingName(file.name)
    setUploadProgress(0)
    try {
      const created = await uploadAttachment(projectId, taskId, file, {
        onProgress: setUploadProgress,
      })
      onChange?.([
        {
          ...created,
          uploader_name: 'Bạn',
        },
        ...items,
      ])
    } catch (err) {
      setError(err.message || 'Upload thất bại.')
    } finally {
      setUploadingName(null)
      setUploadProgress(0)
    }
  }

  const handleAddByUrl = async (e) => {
    e?.preventDefault?.()
    const trimmedName = fileName.trim()
    const trimmedUrl = fileUrl.trim()
    if (!trimmedName) return setError('Tên file bắt buộc.')
    if (!trimmedUrl) return setError('URL bắt buộc.')
    if (!URL_REGEX.test(trimmedUrl)) return setError('URL phải bắt đầu bằng http:// hoặc https://')

    setSubmitting(true)
    setError(null)
    try {
      const created = await addAttachment(projectId, taskId, {
        fileName: trimmedName,
        fileUrl: trimmedUrl,
      })
      onChange?.([{ ...created, uploader_name: 'Bạn' }, ...items])
      resetUrlForm()
    } catch (err) {
      setError(err.message || 'Không thêm được đính kèm.')
    } finally {
      setSubmitting(false)
    }
  }

  const askDelete = (a) => setConfirmDelete({ open: true, attachment: a, busy: false })
  const closeDelete = () => setConfirmDelete({ open: false, attachment: null, busy: false })

  const handleConfirmDelete = async () => {
    const target = confirmDelete.attachment
    if (!target) return
    setConfirmDelete((s) => ({ ...s, busy: true }))
    try {
      await deleteAttachment(projectId, taskId, target.id)
      onChange?.(items.filter((a) => a.id !== target.id))
      closeDelete()
    } catch (err) {
      setError(err.message || 'Không xóa được đính kèm.')
      setConfirmDelete((s) => ({ ...s, busy: false }))
    }
  }

  const busy = submitting || !!uploadingName

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Tài liệu đính kèm ({items.length})
        </h4>
        {!readOnly ? (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handlePickFile}
              disabled={busy}
              className="text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="upload" className="text-[14px]" />
              Tải lên (≤{MAX_SIZE_MB}MB)
            </button>
            {!showUrlForm ? (
              <button
                type="button"
                onClick={() => setShowUrlForm(true)}
                disabled={busy}
                className="text-xs font-semibold text-on-surface-variant hover:text-primary-700 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Icon name="link" className="text-[14px]" />
                Dán URL
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Progress bar khi đang upload */}
      {uploadingName ? (
        <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-primary-900">
            <Icon name="progress_activity" className="text-base spin" />
            <span className="flex-1 truncate font-medium">{uploadingName}</span>
            <span className="font-semibold tabular-nums">{uploadProgress}%</span>
          </div>
          <div className="h-1.5 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-container transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* URL form (alternative khi không có file vật lý — Drive/Dropbox) */}
      {showUrlForm ? (
        <form
          onSubmit={handleAddByUrl}
          className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 flex flex-col gap-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Tên file (vd: design.pdf)"
              disabled={submitting}
              className="sm:col-span-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
            />
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..."
              disabled={submitting}
              className="sm:col-span-2 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={resetUrlForm} disabled={submitting}>
              Hủy
            </Button>
            <Button type="submit" size="sm" onClick={handleAddByUrl} disabled={submitting}>
              {submitting ? (
                <>
                  <Icon name="progress_activity" className="text-sm spin" />
                  Đang thêm...
                </>
              ) : (
                <>
                  <Icon name="link" className="text-[14px]" />
                  Lưu URL
                </>
              )}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="text-xs text-error bg-danger-50 border border-error-container rounded-lg px-3 py-2 flex items-start gap-2">
          <Icon name="error" filled className="text-base mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-error/70 hover:text-error">
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="text-xs text-outline italic py-2">
          Chưa có tài liệu nào. Đính kèm minh chứng trước khi gửi nghiệm thu.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((a) => {
            const canDelete = !readOnly && (canManage || a.uploaded_by === currentUserId)
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg hover:border-primary-100 transition-colors group"
              >
                <Icon name="description" className="text-outline text-[18px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={a.file_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-medium text-on-surface hover:text-primary-700 hover:underline truncate block"
                    title={a.file_url}
                  >
                    {a.file_name}
                  </a>
                  <div className="text-[11px] text-outline">
                    {a.uploader_name ?? 'Không rõ'} · {formatDate(a.created_at)}
                    {a.size ? ` · ${formatBytes(a.size)}` : ''}
                  </div>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => askDelete(a)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-outline hover:text-danger-500 hover:bg-danger-50 rounded"
                    title="Xóa"
                  >
                    <Icon name="delete" className="text-[16px]" />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        loading={confirmDelete.busy}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
        tone="danger"
        title="Xóa đính kèm"
        confirmLabel="Xóa"
        message={
          confirmDelete.attachment
            ? `Xóa đính kèm "${confirmDelete.attachment.file_name}"?\nThao tác này không thể hoàn tác.`
            : ''
        }
      />
    </div>
  )
}
