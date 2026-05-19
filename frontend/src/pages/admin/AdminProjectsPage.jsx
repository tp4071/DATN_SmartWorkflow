import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  SearchInput,
  Select,
  Spinner,
  useToast,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import {
  archiveProject,
  closeProject,
  createProject,
  listProjects,
  reopenProject,
  updateProject,
} from '../../services/projects.api'
import { ProjectFormModal } from './ProjectFormModal'
import { removeVietnameseTones } from '../../utils/vietnameseSearch'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'Đang hoạt động', label: 'Đang hoạt động' },
  { value: 'Đóng', label: 'Đã đóng' },
  { value: 'Lưu trữ', label: 'Lưu trữ' },
]

const STATUS_TONE = {
  'Đang hoạt động': 'success',
  Đóng: 'neutral',
  'Lưu trữ': 'warning',
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminProjectsPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [formState, setFormState] = useState({ open: false, mode: 'create', project: null })
  // action: 'close' | 'reopen' | 'archive'
  const [confirmState, setConfirmState] = useState({
    open: false,
    project: null,
    action: 'close',
    busy: false,
  })

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err.message || 'Không tải được danh sách dự án.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    return projects.filter((p) => {
      if (kw) {
        const hay = removeVietnameseTones(`${p.project_code ?? ''} ${p.name ?? ''}`)
        if (!hay.includes(kw)) return false
      }
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      return true
    })
  }, [projects, keyword, statusFilter])

  const openCreate = () => setFormState({ open: true, mode: 'create', project: null })
  const openEdit = (project) => setFormState({ open: true, mode: 'edit', project })
  const closeForm = () => setFormState((s) => ({ ...s, open: false }))

  const handleSubmitForm = async (payload) => {
    if (formState.mode === 'edit') {
      const updated = await updateProject(formState.project.id, {
        name: payload.name,
        description: payload.description,
        startDate: payload.startDate,
        endDate: payload.endDate,
        pmId: payload.pmId,
      })
      setProjects((arr) =>
        arr.map((p) =>
          p.id === updated.id
            ? {
                ...p,
                ...updated,
                pm_full_name:
                  updated.pm_id === p.pm_id ? p.pm_full_name : null /* sẽ refetch để có tên PM */,
              }
            : p,
        ),
      )
      // Nếu đổi PM thì refetch để lấy đúng tên PM mới
      if (formState.project.pm_id !== updated.pm_id) {
        fetchProjects()
      }
      toast.success('Cập nhật dự án thành công')
    } else {
      const created = await createProject(payload)
      // POST /api/projects không trả pm_full_name → refetch để có dữ liệu hoàn chỉnh
      setProjects((arr) => [{ ...created, pm_full_name: null }, ...arr])
      fetchProjects()
      toast.success('Tạo dự án thành công')
    }
    closeForm()
  }

  const askStatusChange = (project, action) =>
    setConfirmState({ open: true, project, action, busy: false })
  const closeConfirm = () =>
    setConfirmState({ open: false, project: null, action: 'close', busy: false })

  // Mapping action -> { api, successMsg, errorMsg } để 1 dialog xử lý cả 3 case.
  const ACTION_MAP = {
    close: {
      api: closeProject,
      successMsg: 'Đã đóng dự án',
      errorMsg: 'Không đóng được dự án.',
    },
    reopen: {
      api: reopenProject,
      successMsg: 'Đã mở lại dự án',
      errorMsg: 'Không mở lại được dự án.',
    },
    archive: {
      api: archiveProject,
      successMsg: 'Đã đưa dự án vào lưu trữ',
      errorMsg: 'Không lưu trữ được dự án.',
    },
  }

  const handleConfirmAction = async () => {
    const target = confirmState.project
    const action = confirmState.action
    if (!target || !ACTION_MAP[action]) return
    setConfirmState((s) => ({ ...s, busy: true }))
    try {
      const updated = await ACTION_MAP[action].api(target.id)
      setProjects((arr) =>
        arr.map((p) => (p.id === updated.id ? { ...p, status: updated.status } : p)),
      )
      toast.success(ACTION_MAP[action].successMsg)
      closeConfirm()
    } catch (err) {
      toast.error(err.message || ACTION_MAP[action].errorMsg)
      setConfirmState((s) => ({ ...s, busy: false }))
    }
  }

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: ROUTE_PATHS.admin.dashboard },
          { label: 'Quản lý dự án' },
        ]}
      />
      <PageHeader
        title="Quản lý dự án"
        description="Khởi tạo dự án, phân công người quản lý và theo dõi trạng thái vòng đời."
        actions={
          <Button onClick={openCreate}>
            <Icon name="add" className="text-[20px]" />
            Thêm dự án
          </Button>
        }
      />

      <FilterBar
        right={
          !loading ? (
            <span className="text-xs text-outline">
              {filtered.length} / {projects.length} dự án
            </span>
          ) : null
        }
      >
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="Tìm theo mã hoặc tên dự án..."
          widthClass="w-full sm:w-72"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS}
          ariaLabel="Lọc theo trạng thái"
          widthClass="w-full sm:w-52"
        />
      </FilterBar>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải danh sách dự án..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchProjects}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon="folder_open"
          title="Chưa có dự án nào"
          description="Bắt đầu bằng cách khởi tạo dự án đầu tiên và bổ nhiệm PM."
          action={
            <Button onClick={openCreate}>
              <Icon name="add" className="text-[18px]" />
              Thêm dự án
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="Không tìm thấy kết quả"
          description="Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc."
        />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-700">
              <tr>
                <th className="px-4 py-3 font-semibold w-12 text-center">#</th>
                <th className="px-4 py-3 font-semibold">Mã dự án</th>
                <th className="px-4 py-3 font-semibold">Tên dự án</th>
                <th className="px-4 py-3 font-semibold">Quản lý</th>
                <th className="px-4 py-3 font-semibold">Bắt đầu</th>
                <th className="px-4 py-3 font-semibold">Kết thúc</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-neutral-200">
              {filtered.map((p, idx) => {
                const isActive = p.status === 'Đang hoạt động'
                const isClosed = p.status === 'Đóng'
                const isArchived = p.status === 'Lưu trữ'
                return (
                  <tr key={p.id} className="hover:bg-primary-50 transition-colors group">
                    <td className="px-4 py-3 text-center text-on-surface-variant">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-on-surface">
                      {p.project_code}
                    </td>
                    <td className="px-4 py-3 text-on-surface">
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                          {p.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {p.pm_full_name ? (
                        <div className="flex items-center gap-2">
                          <Avatar initials={makeInitials(p.pm_full_name)} size="xs" />
                          <span className="text-on-surface">{p.pm_full_name}</span>
                        </div>
                      ) : (
                        <span className="text-outline italic">Chưa có PM</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {formatDate(p.start_date)}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {formatDate(p.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={STATUS_TONE[p.status] ?? 'neutral'}>{p.status}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(ROUTE_PATHS.project.board(p.id))}
                          className="p-1.5 text-neutral-700 hover:text-primary-container hover:bg-primary-50 rounded transition-colors"
                          title="Xem workspace"
                        >
                          <Icon name="visibility" className="text-[20px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-neutral-700 hover:text-primary-container hover:bg-primary-50 rounded transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Icon name="edit" className="text-[20px]" />
                        </button>
                        {/* Mở lại — chỉ hiện khi đang Đóng hoặc Lưu trữ */}
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => askStatusChange(p, 'reopen')}
                            className="p-1.5 rounded transition-colors text-success-600 hover:bg-success-50"
                            title="Mở lại dự án"
                          >
                            <Icon name="play_circle" className="text-[20px]" />
                          </button>
                        ) : null}
                        {/* Đóng — chỉ hiện khi Đang hoạt động */}
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => askStatusChange(p, 'close')}
                            className="p-1.5 rounded transition-colors text-danger-500 hover:bg-danger-50"
                            title="Đóng dự án"
                          >
                            <Icon name="cancel" className="text-[20px]" />
                          </button>
                        ) : null}
                        {/* Lưu trữ — ẩn khi đã ở Lưu trữ */}
                        {!isArchived ? (
                          <button
                            type="button"
                            onClick={() => askStatusChange(p, 'archive')}
                            className="p-1.5 rounded transition-colors text-tertiary-700 hover:bg-tertiary-50"
                            title="Đưa vào lưu trữ"
                          >
                            <Icon name="inventory_2" className="text-[20px]" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProjectFormModal
        open={formState.open}
        mode={formState.mode}
        initialProject={formState.project}
        onClose={closeForm}
        onSubmit={handleSubmitForm}
      />

      <ConfirmDialog
        open={confirmState.open}
        loading={confirmState.busy}
        onClose={closeConfirm}
        onConfirm={handleConfirmAction}
        tone={
          confirmState.action === 'reopen'
            ? 'success'
            : confirmState.action === 'archive'
              ? 'warning'
              : 'danger'
        }
        title={
          confirmState.action === 'reopen'
            ? 'Mở lại dự án'
            : confirmState.action === 'archive'
              ? 'Đưa vào lưu trữ'
              : 'Đóng dự án'
        }
        confirmLabel={
          confirmState.action === 'reopen'
            ? 'Mở lại'
            : confirmState.action === 'archive'
              ? 'Lưu trữ'
              : 'Đóng dự án'
        }
        message={
          confirmState.project
            ? confirmState.action === 'reopen'
              ? `Mở lại dự án "${confirmState.project.name}"?\nDự án sẽ trở về trạng thái Đang hoạt động, PM và thành viên có thể tiếp tục làm việc.`
              : confirmState.action === 'archive'
                ? `Đưa "${confirmState.project.name}" vào lưu trữ?\nDự án vẫn xem được nhưng được tách khỏi danh sách hoạt động.`
                : `Bạn có chắc chắn muốn đóng dự án "${confirmState.project.name}"?\nDự án bị đóng sẽ không nhận thêm thay đổi mới.`
            : ''
        }
      />
    </>
  )
}
