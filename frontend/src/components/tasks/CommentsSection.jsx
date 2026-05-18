import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Button, Icon, ConfirmDialog } from '../ui'
import {
  createComment,
  deleteComment,
  updateComment,
} from '../../services/taskComments.api'
import { removeVietnameseTones } from '../../utils/vietnameseSearch'

const MENTION_LIMIT = 8

const MAX_LEN = 5000

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Section bình luận (UC13).
 *
 * Props:
 *   projectId, taskId
 *   items: mảng comments hiện có (sort created_at ASC từ backend)
 *   currentUserId
 *   canManage: PM/Admin được xóa mọi comment
 *   members: danh sách thành viên dự án (cho @mention picker) — mỗi item:
 *     { user_id, full_name, email, project_role }
 *   onChange(items): callback khi list thay đổi
 */
export function CommentsSection({
  projectId,
  taskId,
  items = [],
  currentUserId,
  canManage,
  readOnly = false,
  members = [],
  onChange,
}) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  const [confirmDel, setConfirmDel] = useState({ open: false, comment: null, busy: false })

  // === @mention state ===
  // mentions: danh sách user đã được @ trong composer hiện tại.
  //   Mỗi item: { id, full_name }. Khi submit chỉ giữ id mà text "@<name>"
  //   còn xuất hiện trong content (user có thể đã xoá).
  const [mentions, setMentions] = useState([])
  // mentionPicker: state autocomplete đang mở.
  //   { query, atIdx, cursorPos, highlight } | null
  const [mentionPicker, setMentionPicker] = useState(null)
  const textareaRef = useRef(null)

  // Loại các thành viên đang là chính người dùng + dedupe theo user_id.
  const candidateMembers = useMemo(() => {
    const seen = new Set()
    const arr = []
    for (const m of members || []) {
      if (!m?.user_id || m.user_id === currentUserId) continue
      if (seen.has(m.user_id)) continue
      seen.add(m.user_id)
      arr.push(m)
    }
    return arr
  }, [members, currentUserId])

  const filteredCandidates = useMemo(() => {
    if (!mentionPicker) return []
    const q = removeVietnameseTones(mentionPicker.query)
    const matched = q
      ? candidateMembers.filter((m) =>
          removeVietnameseTones(`${m.full_name} ${m.email}`).includes(q),
        )
      : candidateMembers
    return matched.slice(0, MENTION_LIMIT)
  }, [mentionPicker, candidateMembers])

  // Khi danh sách lọc co lại, highlight có thể vượt biên — kẹp lại.
  useEffect(() => {
    if (!mentionPicker) return
    if (mentionPicker.highlight >= filteredCandidates.length) {
      setMentionPicker((s) => (s ? { ...s, highlight: 0 } : s))
    }
  }, [filteredCandidates, mentionPicker])

  const closeMentionPicker = () => setMentionPicker(null)

  // Phân tích nội dung textarea quanh con trỏ để bật/tắt picker.
  const updateMentionState = (value, cursorPos) => {
    const before = value.slice(0, cursorPos)
    // Khớp @ ngay sau đầu chuỗi hoặc khoảng trắng/newline. Query không chứa space/@.
    const match = before.match(/(?:^|\s)@([^\s@]{0,40})$/)
    if (!match) {
      if (mentionPicker) closeMentionPicker()
      return
    }
    const query = match[1]
    const atIdx = cursorPos - query.length - 1
    setMentionPicker((prev) => ({
      query,
      atIdx,
      cursorPos,
      highlight: prev?.highlight ?? 0,
    }))
  }

  const handleContentChange = (e) => {
    const value = e.target.value
    setContent(value)
    updateMentionState(value, e.target.selectionStart ?? value.length)
  }

  const handleSelectionChange = (e) => {
    updateMentionState(e.target.value, e.target.selectionStart ?? 0)
  }

  const pickMention = (member) => {
    if (!mentionPicker) return
    const { atIdx, cursorPos } = mentionPicker
    const before = content.slice(0, atIdx)
    const after = content.slice(cursorPos)
    const inserted = `@${member.full_name} `
    const newContent = before + inserted + after
    setContent(newContent)
    setMentions((prev) =>
      prev.some((m) => m.id === member.user_id)
        ? prev
        : [...prev, { id: member.user_id, full_name: member.full_name }],
    )
    closeMentionPicker()
    // Đặt lại caret ngay sau text vừa chèn
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      const newPos = atIdx + inserted.length
      ta.focus()
      ta.setSelectionRange(newPos, newPos)
    })
  }

  const handleComposerKeyDown = (e) => {
    if (!mentionPicker || filteredCandidates.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionPicker((s) => ({
        ...s,
        highlight: (s.highlight + 1) % filteredCandidates.length,
      }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionPicker((s) => ({
        ...s,
        highlight:
          (s.highlight - 1 + filteredCandidates.length) % filteredCandidates.length,
      }))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pickMention(filteredCandidates[mentionPicker.highlight])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMentionPicker()
    }
  }

  const handleSend = async (e) => {
    e?.preventDefault?.()
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Nội dung không được để trống.')
      return
    }
    if (trimmed.length > MAX_LEN) {
      setError(`Nội dung tối đa ${MAX_LEN} ký tự.`)
      return
    }
    // Chỉ giữ mention nếu "@<full_name>" vẫn còn trong nội dung gửi đi.
    const activeMentionIds = mentions
      .filter((m) => trimmed.includes(`@${m.full_name}`))
      .map((m) => m.id)

    setSubmitting(true)
    setError(null)
    try {
      const created = await createComment(projectId, taskId, trimmed, activeMentionIds)
      onChange?.([...items, { ...created, is_edited: created.is_edited ?? false }])
      setContent('')
      setMentions([])
      closeMentionPicker()
    } catch (err) {
      setError(err.message || 'Không gửi được bình luận.')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (c) => {
    setEditingId(c.id)
    setEditContent(c.content ?? '')
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }
  const handleSaveEdit = async (c) => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    if (trimmed === c.content) {
      cancelEdit()
      return
    }
    setEditBusy(true)
    try {
      const updated = await updateComment(projectId, taskId, c.id, trimmed)
      onChange?.(
        items.map((it) =>
          it.id === c.id
            ? {
                ...it,
                content: updated.content,
                is_edited: true,
                updated_at: updated.updated_at,
              }
            : it,
        ),
      )
      cancelEdit()
    } catch {
      // hiện inline error
    } finally {
      setEditBusy(false)
    }
  }

  const askDelete = (c) => setConfirmDel({ open: true, comment: c, busy: false })
  const closeDelete = () => setConfirmDel({ open: false, comment: null, busy: false })
  const handleConfirmDelete = async () => {
    const target = confirmDel.comment
    if (!target) return
    setConfirmDel((s) => ({ ...s, busy: true }))
    try {
      await deleteComment(projectId, taskId, target.id)
      onChange?.(items.filter((it) => it.id !== target.id))
      closeDelete()
    } catch {
      setConfirmDel((s) => ({ ...s, busy: false }))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
        Thảo luận ({items.length})
      </h4>

      {items.length === 0 ? (
        <div className="text-xs text-outline italic py-2">
          Chưa có bình luận. Hãy là người đầu tiên thảo luận về công việc này.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const isAuthor = c.user_id === currentUserId
            const canDelete = !readOnly && (isAuthor || canManage)
            const isEditing = editingId === c.id
            const canEditComment = !readOnly && isAuthor
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar initials={makeInitials(c.full_name)} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-on-surface">
                      {c.full_name ?? 'Người dùng'}
                    </span>
                    <span className="text-outline">{formatDateTime(c.created_at)}</span>
                    {c.is_edited ? (
                      <span className="text-outline italic">(đã chỉnh sửa)</span>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <div className="mt-1 flex flex-col gap-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container resize-none"
                        maxLength={MAX_LEN}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editBusy}>
                          Hủy
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(c)} disabled={editBusy}>
                          {editBusy ? 'Đang lưu...' : 'Lưu'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 group flex items-start gap-2">
                      <p className="text-sm text-on-surface whitespace-pre-line flex-1 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
                        {c.content}
                      </p>
                      {(canEditComment || canDelete) && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                          {canEditComment ? (
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              className="p-1 text-outline hover:text-primary-700 hover:bg-primary-50 rounded"
                              title="Chỉnh sửa"
                            >
                              <Icon name="edit" className="text-[14px]" />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => askDelete(c)}
                              className="p-1 text-outline hover:text-danger-500 hover:bg-danger-50 rounded"
                              title="Xóa"
                            >
                              <Icon name="delete" className="text-[14px]" />
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Form gửi comment mới — ẩn khi đang ở chế độ chỉ-xem (Admin) */}
      {readOnly ? null : (
      <form
        onSubmit={handleSend}
        className="flex flex-col gap-2 border-t border-neutral-200 pt-3"
      >
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleComposerKeyDown}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            onBlur={() => setTimeout(closeMentionPicker, 150)}
            rows={2}
            maxLength={MAX_LEN}
            placeholder="Viết bình luận... (gõ @ để nhắc thành viên)"
            disabled={submitting}
            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container resize-none"
          />
          {mentionPicker && filteredCandidates.length > 0 ? (
            <ul className="absolute left-0 right-0 bottom-full mb-1 z-30 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
              {filteredCandidates.map((m, idx) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // onMouseDown chạy trước onBlur của textarea -> giữ được state
                      e.preventDefault()
                      pickMention(m)
                    }}
                    onMouseEnter={() =>
                      setMentionPicker((s) => (s ? { ...s, highlight: idx } : s))
                    }
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                      idx === mentionPicker.highlight
                        ? 'bg-primary-50 text-primary-800'
                        : 'hover:bg-neutral-50 text-on-surface'
                    }`}
                  >
                    <Avatar initials={makeInitials(m.full_name)} size="sm" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{m.full_name}</span>
                      <span className="block text-[11px] text-outline truncate">{m.email}</span>
                    </span>
                    {m.project_role === 'MANAGER' ? (
                      <span className="text-[10px] uppercase tracking-wide text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">
                        PM
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {mentionPicker && filteredCandidates.length === 0 ? (
            <div className="absolute left-0 right-0 bottom-full mb-1 z-30 bg-white border border-neutral-200 rounded-lg shadow-lg px-3 py-2 text-xs text-outline">
              Không tìm thấy thành viên khớp "{mentionPicker.query}"
            </div>
          ) : null}
        </div>
        {error ? <span className="text-xs text-error">{error}</span> : null}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-outline">
            {content.length}/{MAX_LEN}
          </span>
          <Button type="submit" size="sm" onClick={handleSend} disabled={submitting || !content.trim()}>
            {submitting ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang gửi...
              </>
            ) : (
              <>
                <Icon name="send" className="text-[14px]" />
                Gửi
              </>
            )}
          </Button>
        </div>
      </form>
      )}

      <ConfirmDialog
        open={confirmDel.open}
        loading={confirmDel.busy}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
        tone="danger"
        title="Xóa bình luận"
        confirmLabel="Xóa"
        message="Xóa bình luận này? Thao tác không thể hoàn tác."
      />
    </div>
  )
}
