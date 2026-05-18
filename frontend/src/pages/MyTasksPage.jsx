import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Pill,
  PriorityBadge,
  SearchInput,
  Select,
  Spinner,
  StatusBadge,
} from '../components/ui'
import { ROUTE_PATHS } from '../router/paths'
import { listMyTasks } from '../services/myTasks.api'
import { removeVietnameseTones } from '../utils/vietnameseSearch'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'Cần làm', label: 'Cần làm' },
  { value: 'Đang làm', label: 'Đang làm' },
  { value: 'Chờ đánh giá', label: 'Chờ đánh giá' },
  { value: 'Hoàn thành', label: 'Hoàn thành' },
]

const DUE_FILTERS = [
  { value: 'ALL', label: 'Tất cả hạn chót' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'this_week', label: 'Trong 7 ngày' },
  { value: 'no_due', label: 'Chưa đặt hạn' },
]

// Map status -> key của StatusBadge (component chỉ biết các key todo|inprog|review|done).
const STATUS_TO_BADGE_KEY = {
  'Cần làm': 'todo',
  'Đang làm': 'inprog',
  'Chờ đánh giá': 'review',
  'Hoàn thành': 'done',
}

const PROJECT_STATUS_TONE = {
  'Đang hoạt động': 'success',
  Đóng: 'neutral',
  'Lưu trữ': 'warning',
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'Hoàn thành') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(task.due_date)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function TaskRow({ task }) {
  const overdue = isOverdue(task)
  const dueLabel = formatDate(task.due_date)

  return (
    <article className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col gap-3 hover:border-primary-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-outline mb-1">
            <Icon name="folder" className="text-[14px]" />
            <Link
              to={ROUTE_PATHS.project.board(task.project_id)}
              className="font-semibold uppercase tracking-wider hover:text-primary-700"
            >
              {task.project_code}
            </Link>
            <span className="text-neutral-300">·</span>
            <span className="truncate">{task.project_name}</span>
            {task.project_status && task.project_status !== 'Đang hoạt động' ? (
              <Pill tone={PROJECT_STATUS_TONE[task.project_status] ?? 'neutral'}>
                {task.project_status}
              </Pill>
            ) : null}
          </div>
          <h3 className="font-h3 text-h3 text-on-surface line-clamp-2">{task.title}</h3>
          {task.description ? (
            <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{task.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-none">
          <StatusBadge status={STATUS_TO_BADGE_KEY[task.status] ?? 'todo'} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span
            className={`flex items-center gap-1.5 ${overdue ? 'text-danger-500 font-semibold' : ''}`}
          >
            <Icon name="event" className="text-[16px]" />
            {dueLabel ?? 'Chưa đặt hạn'}
            {overdue ? <Pill tone="danger">Quá hạn</Pill> : null}
          </span>
          {task.estimate_hours != null ? (
            <span className="flex items-center gap-1.5">
              <Icon name="schedule" className="text-[16px]" />
              {task.estimate_hours}h
            </span>
          ) : null}
        </div>
        <Link
          to={ROUTE_PATHS.project.board(task.project_id)}
          className="text-primary-700 hover:text-primary-900 font-semibold flex items-center gap-1"
        >
          Mở dự án
          <Icon name="arrow_forward" className="text-[14px]" />
        </Link>
      </div>
    </article>
  )
}

function StatCard({ label, value, tone = 'neutral', icon }) {
  const tones = {
    neutral: 'border-neutral-200 text-on-surface',
    primary: 'border-primary-200 text-primary-900',
    warning: 'border-tertiary-300 text-tertiary-900',
    success: 'border-success-200 text-success-600',
    danger: 'border-danger-200 text-danger-500',
  }
  return (
    <div className={`bg-white rounded-lg border ${tones[tone] ?? tones.neutral} p-4 flex items-center gap-3`}>
      <div className="w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center">
        <Icon name={icon} />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-outline mt-1">{label}</div>
      </div>
    </div>
  )
}

export function MyTasksPage() {
  const [tasks, setTasks] = useState([])
  const [statusCounts, setStatusCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dueFilter, setDueFilter] = useState('ALL')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await listMyTasks({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        due: dueFilter === 'ALL' ? undefined : dueFilter,
      })
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
      setStatusCounts(data.statusCounts ?? {})
    } catch (err) {
      setLoadError(err.message || 'Không tải được công việc của bạn.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, dueFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const filtered = useMemo(() => {
    const kw = removeVietnameseTones(keyword)
    if (!kw) return tasks
    return tasks.filter((t) => {
      const hay = removeVietnameseTones(
        `${t.title ?? ''} ${t.description ?? ''} ${t.project_name ?? ''} ${t.project_code ?? ''}`
      )
      return hay.includes(kw)
    })
  }, [tasks, keyword])

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t)).length,
    [tasks],
  )

  const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0)

  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ' }, { label: 'Công việc của tôi' }]} />
      <PageHeader
        title="Công việc của tôi"
        description="Tổng hợp công việc bạn đang phụ trách trên mọi dự án — sắp xếp theo độ ưu tiên và hạn chót."
      />

      {!loading && !loadError ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-gap">
          <StatCard
            icon="assignment"
            label="Tổng đang phụ trách"
            value={totalCount}
            tone="primary"
          />
          <StatCard
            icon="play_circle"
            label="Đang làm"
            value={statusCounts['Đang làm'] ?? 0}
            tone="primary"
          />
          <StatCard
            icon="hourglass_top"
            label="Chờ đánh giá"
            value={statusCounts['Chờ đánh giá'] ?? 0}
            tone="warning"
          />
          <StatCard
            icon="warning"
            label="Quá hạn"
            value={overdueCount}
            tone={overdueCount > 0 ? 'danger' : 'neutral'}
          />
        </div>
      ) : null}

      <FilterBar
        right={
          !loading ? (
            <span className="text-xs text-outline">
              {filtered.length} / {tasks.length} hiển thị
            </span>
          ) : null
        }
      >
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="Tìm theo tiêu đề, dự án..."
          widthClass="w-full sm:w-80"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS}
          ariaLabel="Lọc theo trạng thái"
          widthClass="w-full sm:w-48"
        />
        <Select
          value={dueFilter}
          onChange={setDueFilter}
          options={DUE_FILTERS}
          ariaLabel="Lọc theo hạn chót"
          widthClass="w-full sm:w-48"
        />
      </FilterBar>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải công việc..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchTasks}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="task_alt"
          title="Bạn chưa có công việc nào được giao"
          description="Khi PM giao việc cho bạn ở bất kỳ dự án nào, công việc sẽ tổng hợp tại đây."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search_off"
          title="Không tìm thấy công việc khớp bộ lọc"
          description="Thử bỏ bớt từ khóa hoặc đổi bộ lọc."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setKeyword('')
                setStatusFilter('ALL')
                setDueFilter('ALL')
              }}
            >
              <Icon name="filter_alt_off" className="text-[18px]" />
              Xóa bộ lọc
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-gap">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </>
  )
}
