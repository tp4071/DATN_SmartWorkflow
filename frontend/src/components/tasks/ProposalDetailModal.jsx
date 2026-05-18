import { Modal, Button, Icon, Avatar, PriorityBadge } from '../ui'

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
 * Modal xem chi tiết 1 đề xuất + 2 action chính.
 *
 * Props:
 *   open, onClose
 *   proposal: task object trong status 'Chờ duyệt'
 *   busy: 'approve' | 'reject' | null  (đang gọi API)
 *   onApprove(), onReject()
 */
export function ProposalDetailModal({ open, proposal, busy, onClose, onApprove, onReject }) {
  if (!proposal) return null

  const creatorName = proposal.creator_name ?? proposal.assignee_name ?? null
  const isBusy = busy !== null && busy !== undefined

  return (
    <Modal
      open={open}
      onClose={isBusy ? () => {} : onClose}
      title="Chi tiết đề xuất công việc"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Đóng
          </Button>
          <Button variant="danger" onClick={onReject} disabled={isBusy}>
            {busy === 'reject' ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <Icon name="close" className="text-[18px]" />
                Từ chối
              </>
            )}
          </Button>
          <Button variant="primary" onClick={onApprove} disabled={isBusy}>
            {busy === 'approve' ? (
              <>
                <Icon name="progress_activity" className="text-sm spin" />
                Đang duyệt...
              </>
            ) : (
              <>
                <Icon name="check" className="text-[18px]" />
                Phê duyệt
              </>
            )}
          </Button>
        </>
      }
    >
      <div className="p-6 flex flex-col gap-4">
        <div>
          <h3 className="text-h2 font-h2 text-on-surface">{proposal.title}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <PriorityBadge priority={proposal.priority} />
            {proposal.estimate_hours ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-neutral-50 text-neutral-700 border-neutral-200">
                <Icon name="schedule" className="text-[14px]" />
                {proposal.estimate_hours} giờ
              </span>
            ) : null}
            {proposal.due_date ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-tertiary-50 text-tertiary-700 border-tertiary-300">
                <Icon name="event" className="text-[14px]" />
                Hạn {formatDate(proposal.due_date)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Mô tả
          </div>
          <p className="text-sm text-on-surface whitespace-pre-line">
            {proposal.description ? proposal.description : (
              <span className="italic text-outline">Không có mô tả.</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Đề xuất bởi
            </div>
            {creatorName ? (
              <div className="flex items-center gap-2">
                <Avatar initials={makeInitials(creatorName)} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-on-surface truncate">
                    {creatorName}
                  </div>
                  {proposal.creator_email ? (
                    <div className="text-xs text-on-surface-variant truncate">
                      {proposal.creator_email}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <span className="text-sm text-outline italic">Không xác định</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Người phụ trách đề xuất
            </div>
            {proposal.assignee_name ? (
              <div className="flex items-center gap-2">
                <Avatar initials={makeInitials(proposal.assignee_name)} size="sm" />
                <span className="text-sm text-on-surface">{proposal.assignee_name}</span>
              </div>
            ) : (
              <span className="text-sm text-outline italic">
                Chưa phân công — bạn có thể gán người phụ trách sau khi duyệt
              </span>
            )}
          </div>
        </div>

        <div className="text-[11px] text-outline border-t border-neutral-200 pt-3">
          Gửi lúc {formatDateTime(proposal.created_at)}
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-tertiary-50 border border-tertiary-300 text-tertiary-700 text-xs">
          <Icon name="warning" filled className="text-base mt-0.5" />
          <span>
            Phê duyệt sẽ chuyển task vào cột "Cần làm" trên Kanban. Từ chối sẽ
            <strong> xoá vĩnh viễn</strong> đề xuất khỏi hệ thống — không khôi phục được.
          </span>
        </div>
      </div>
    </Modal>
  )
}
