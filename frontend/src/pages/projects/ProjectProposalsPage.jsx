import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Breadcrumb,
  Button,
  ConfirmDialog,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Pill,
  PriorityBadge,
  SearchInput,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import { useNotifications } from '../../context/NotificationContext'
import { subscribeProject, unsubscribeProject } from '../../services/socket'
import {
  approveProposal,
  listPendingProposals,
  rejectProposal,
} from '../../services/tasks.api'
import { ProposalDetailModal } from '../../components/tasks/ProposalDetailModal'
import { removeVietnameseTones } from '../../utils/vietnameseSearch'

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

function formatRelative(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffMin = Math.floor((Date.now() - t) / 60000)
  if (diffMin < 1) return 'vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ProjectProposalsPage() {
  const { project, projectId, canManage } = useProject()
  const toast = useToast()
  const { onSocketEvent } = useNotifications()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [keyword, setKeyword] = useState('')
  const [detailState, setDetailState] = useState({ open: false, proposal: null, busy: null })
  const [confirmReject, setConfirmReject] = useState({ open: false, proposal: null, busy: false })

  const fetchProposals = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listPendingProposals(projectId)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err.message || 'Không tải được danh sách đề xuất.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchProposals()
  }, [fetchProposals])

  // Live update: subscribe project room. Khi có task mới được đề xuất hoặc đã được
  // duyệt/từ chối ở tab khác, refetch để đồng bộ.
  useEffect(() => {
    if (!projectId) return undefined
    subscribeProject(projectId)
    const offUpdated = onSocketEvent('task:updated', () => fetchProposals())
    const offDeleted = onSocketEvent('task:deleted', () => fetchProposals())
    return () => {
      offUpdated()
      offDeleted()
      unsubscribeProject(projectId)
    }
  }, [projectId, onSocketEvent, fetchProposals])

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    if (!kw) return items
    return items.filter((p) => {
      const hay = removeVietnameseTones(
        `${p.title ?? ''} ${p.description ?? ''} ${p.creator_name ?? ''} ${p.assignee_name ?? ''}`
      )
      return hay.includes(kw)
    })
  }, [items, keyword])

  const openDetail = (proposal) =>
    setDetailState({ open: true, proposal, busy: null })
  const closeDetail = () => setDetailState((s) => ({ ...s, open: false }))

  const askReject = (proposal) => setConfirmReject({ open: true, proposal, busy: false })
  const closeReject = () => setConfirmReject({ open: false, proposal: null, busy: false })

  const handleApprove = async (proposal) => {
    setDetailState((s) => ({ ...s, busy: 'approve' }))
    try {
      await approveProposal(projectId, proposal.id)
      setItems((arr) => arr.filter((p) => p.id !== proposal.id))
      toast.success(`Đã phê duyệt "${proposal.title}". Task đã được đẩy vào cột "Cần làm".`)
      closeDetail()
    } catch (err) {
      toast.error(err.message || 'Không phê duyệt được.')
      setDetailState((s) => ({ ...s, busy: null }))
    }
  }

  /** Reject từ ProposalDetailModal — chuyển sang ConfirmDialog cho an toàn. */
  const handleRejectFromDetail = (proposal) => {
    closeDetail()
    askReject(proposal)
  }

  const handleConfirmReject = async () => {
    const target = confirmReject.proposal
    if (!target) return
    setConfirmReject((s) => ({ ...s, busy: true }))
    try {
      await rejectProposal(projectId, target.id)
      setItems((arr) => arr.filter((p) => p.id !== target.id))
      toast.success(`Đã từ chối và xoá đề xuất "${target.title}".`)
      closeReject()
    } catch (err) {
      toast.error(err.message || 'Không từ chối được.')
      setConfirmReject((s) => ({ ...s, busy: false }))
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Đề xuất chờ duyệt' },
        ]}
      />
      <PageHeader
        title="Đề xuất công việc chờ duyệt"
        description={
          canManage
            ? 'Xem xét, phê duyệt hoặc từ chối các đề xuất do thành viên gửi lên. Đề xuất được duyệt sẽ vào cột "Cần làm" trên Kanban.'
            : 'Trang dành cho Quản lý dự án. Bạn có thể đề xuất công việc qua menu "Đề xuất công việc".'
        }
        actions={
          <Button variant="ghost" onClick={fetchProposals} disabled={loading}>
            <Icon name="refresh" className={`text-[18px] ${loading ? 'spin' : ''}`} />
            Làm mới
          </Button>
        }
      />

      {!canManage ? (
        <EmptyState
          icon="lock"
          title="Bạn không có quyền truy cập trang này"
          description="Chỉ Quản lý dự án mới được duyệt đề xuất."
        />
      ) : (
        <>
          <FilterBar
            right={
              !loading ? (
                <span className="text-xs text-outline">
                  {filtered.length} / {items.length} đề xuất
                </span>
              ) : null
            }
          >
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              placeholder="Tìm theo tiêu đề, người đề xuất..."
              widthClass="w-full sm:w-80"
            />
          </FilterBar>

          {loading ? (
            <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
              <Spinner size="lg" label="Đang tải đề xuất..." />
            </div>
          ) : loadError ? (
            <EmptyState
              icon="error"
              title="Không tải được dữ liệu"
              description={loadError}
              action={
                <Button variant="ghost" onClick={fetchProposals}>
                  <Icon name="refresh" className="text-[18px]" />
                  Thử lại
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Hộp đề xuất trống"
              description="Hiện chưa có đề xuất công việc nào chờ bạn duyệt. Khi thành viên gửi đề xuất, nó sẽ xuất hiện tại đây."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="Không khớp từ khóa"
              description="Thử với từ khóa khác."
              action={
                <Button variant="ghost" onClick={() => setKeyword('')}>
                  <Icon name="filter_alt_off" className="text-[18px]" />
                  Bỏ tìm kiếm
                </Button>
              }
            />
          ) : (
            <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Đề xuất</th>
                    <th className="px-4 py-3 font-semibold">Người đề xuất</th>
                    <th className="px-4 py-3 font-semibold">Mức ưu tiên</th>
                    <th className="px-4 py-3 font-semibold">Hạn</th>
                    <th className="px-4 py-3 font-semibold">Gửi lúc</th>
                    <th className="px-4 py-3 font-semibold text-right w-44">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-neutral-200">
                  {filtered.map((p) => {
                    const creatorName = p.creator_name ?? p.assignee_name ?? null
                    return (
                      <tr key={p.id} className="hover:bg-primary-50/40 transition-colors">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetail(p)}
                            className="text-left"
                          >
                            <div className="font-medium text-on-surface hover:text-primary-700 line-clamp-1">
                              {p.title}
                            </div>
                            {p.description ? (
                              <div className="text-xs text-on-surface-variant line-clamp-1 mt-0.5 max-w-md">
                                {p.description}
                              </div>
                            ) : null}
                            {p.estimate_hours ? (
                              <div className="text-[11px] text-outline mt-1 flex items-center gap-1">
                                <Icon name="schedule" className="text-[12px]" />
                                {p.estimate_hours} giờ
                              </div>
                            ) : null}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {creatorName ? (
                            <div className="flex items-center gap-2">
                              <Avatar initials={makeInitials(creatorName)} size="xs" />
                              <span className="text-on-surface truncate">{creatorName}</span>
                            </div>
                          ) : (
                            <span className="text-outline italic">Không rõ</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={p.priority} />
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                          {formatDate(p.due_date)}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                          <Pill tone="neutral">{formatRelative(p.created_at)}</Pill>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleApprove(p)}
                              disabled={detailState.busy !== null}
                              className="p-1.5 rounded transition-colors text-success-600 hover:bg-success-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Phê duyệt nhanh"
                            >
                              <Icon name="check_circle" className="text-[20px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => askReject(p)}
                              disabled={detailState.busy !== null}
                              className="p-1.5 rounded transition-colors text-danger-500 hover:bg-danger-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Từ chối"
                            >
                              <Icon name="cancel" className="text-[20px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDetail(p)}
                              className="p-1.5 rounded transition-colors text-neutral-700 hover:bg-neutral-100"
                              title="Xem chi tiết"
                            >
                              <Icon name="visibility" className="text-[20px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ProposalDetailModal
        open={detailState.open}
        proposal={detailState.proposal}
        busy={detailState.busy}
        onClose={closeDetail}
        onApprove={() => detailState.proposal && handleApprove(detailState.proposal)}
        onReject={() => detailState.proposal && handleRejectFromDetail(detailState.proposal)}
      />

      <ConfirmDialog
        open={confirmReject.open}
        loading={confirmReject.busy}
        onClose={closeReject}
        onConfirm={handleConfirmReject}
        tone="danger"
        title="Từ chối đề xuất"
        confirmLabel="Từ chối & xoá"
        message={
          confirmReject.proposal
            ? `Từ chối đề xuất "${confirmReject.proposal.title}"?\nĐề xuất sẽ bị XOÁ VĨNH VIỄN khỏi hệ thống và người đề xuất sẽ nhận được thông báo realtime.`
            : ''
        }
      />
    </>
  )
}
