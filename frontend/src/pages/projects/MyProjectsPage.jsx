import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Breadcrumb,
  Button,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Pill,
  SearchInput,
  Select,
  Spinner,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProjectsQuery } from '../../hooks/useProjectQueries'
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

function formatDateShort(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateRange(start, end) {
  const s = formatDateShort(start)
  const e = formatDateShort(end)
  if (!s && !e) return 'Chưa có lịch'
  if (s && e) return `${s} – ${e}`
  return s ?? e
}

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ProjectCard({ project }) {
  const isManager = project.project_role === 'MANAGER'
  const isClosed = project.status === 'Đóng'
  return (
    <article
      className={`bg-white rounded-xl border border-neutral-200 flex flex-col hover:border-primary-300 hover:shadow-md transition-all ${
        isClosed ? 'opacity-75' : ''
      }`}
    >
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-outline uppercase tracking-wider">
              {project.project_code}
            </div>
            <h3 className="font-h3 text-h3 text-on-surface mt-1 line-clamp-2">{project.name}</h3>
          </div>
          <Pill tone={STATUS_TONE[project.status] ?? 'neutral'}>{project.status}</Pill>
        </div>

        {project.description ? (
          <p className="text-sm text-on-surface-variant line-clamp-2">{project.description}</p>
        ) : (
          <p className="text-sm text-outline italic">Chưa có mô tả.</p>
        )}

        <div className="flex items-center gap-2 text-xs">
          <Pill tone={isManager ? 'primary' : 'neutral'}>
            {isManager ? 'Bạn là Project Manager' : 'Bạn là Thành viên'}
          </Pill>
        </div>

        {project.pm_full_name ? (
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <Avatar initials={makeInitials(project.pm_full_name)} size="xs" />
            <span>
              PM: <span className="text-on-surface font-medium">{project.pm_full_name}</span>
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-[11px] text-outline mt-auto">
          <Icon name="calendar_month" className="text-[16px]" />
          <span>{formatDateRange(project.start_date, project.end_date)}</span>
        </div>
      </div>

      <div className="p-4 border-t border-neutral-200 bg-neutral-25 rounded-b-xl flex gap-2">
        <Link
          to={ROUTE_PATHS.project.board(project.id)}
          className="flex-1 bg-primary-container text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-900 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="view_kanban" className="text-[18px]" />
          Mở bảng công việc
        </Link>
        {isManager ? (
          <Link
            to={ROUTE_PATHS.project.members(project.id)}
            className="flex-none bg-white border border-neutral-200 text-on-surface px-3 py-2 rounded-lg hover:bg-neutral-50 transition-colors flex items-center justify-center"
            title="Thành viên dự án"
          >
            <Icon name="group" className="text-[18px]" />
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function MyProjectsPage() {
  const { data, isLoading: loading, isError, error, refetch } = useProjectsQuery()
  const projects = data ?? []
  const loadError = isError ? error?.message || 'Không tải được danh sách dự án.' : null
  const fetchProjects = () => refetch()

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    return projects.filter((p) => {
      if (kw) {
        const hay = removeVietnameseTones(
          `${p.project_code ?? ''} ${p.name ?? ''} ${p.description ?? ''}`
        )
        if (!hay.includes(kw)) return false
      }
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      return true
    })
  }, [projects, keyword, statusFilter])

  const managerCount = projects.filter((p) => p.project_role === 'MANAGER').length

  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ' }, { label: 'Dự án của tôi' }]} />
      <PageHeader
        title="Dự án của tôi"
        description="Tổng hợp các dự án bạn đang tham gia với vai trò Quản lý hoặc Thành viên."
      />

      <FilterBar
        right={
          !loading ? (
            <span className="text-xs text-outline">
              {filtered.length} / {projects.length} dự án · {managerCount} bạn quản lý
            </span>
          ) : null
        }
      >
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="Tìm theo mã, tên hoặc mô tả..."
          widthClass="w-full sm:w-80"
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
          <Spinner size="lg" label="Đang tải dự án..." />
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
          icon="folder_off"
          title="Bạn chưa tham gia dự án nào"
          description="Khi được Admin thêm vào một dự án hoặc bổ nhiệm làm Quản lý, dự án sẽ xuất hiện tại đây."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="Không tìm thấy dự án"
          description="Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setKeyword('')
                setStatusFilter('ALL')
              }}
            >
              <Icon name="filter_alt_off" className="text-[18px]" />
              Xóa bộ lọc
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-gap">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </>
  )
}
