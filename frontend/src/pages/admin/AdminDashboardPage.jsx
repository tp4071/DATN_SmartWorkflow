import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  PageHeader,
  Pill,
  Spinner,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { getSystemOverview } from '../../services/admin.api'

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function StatCard({ label, value, icon, accent, to, hint }) {
  const body = (
    <div className="bg-white rounded-lg border border-neutral-200 p-4 flex flex-col gap-2 hover:border-primary-container hover:shadow-sm transition-all h-full">
      <div className="flex justify-between items-start">
        <span className="text-sm font-semibold text-neutral-700">{label}</span>
        <Icon name={icon} className={`text-[22px] ${accent ?? 'text-outline'}`} />
      </div>
      <span className="text-3xl font-bold text-primary-900 leading-none mt-2 tabular-nums">
        {value ?? '—'}
      </span>
      {hint ? <span className="text-xs text-outline">{hint}</span> : null}
    </div>
  )
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

const PROJECT_STATUS_TONE = {
  'Đang hoạt động': 'success',
  Đóng: 'neutral',
  'Lưu trữ': 'warning',
}

export function AdminDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await getSystemOverview())
    } catch (err) {
      setLoadError(err.message || 'Không tải được dữ liệu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const users = data?.users
  const projects = data?.projects
  const tasks = data?.tasks
  const topProjects = data?.topProjects ?? []
  const topWorkload = data?.topWorkload ?? []

  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ' }, { label: 'Tổng quan' }]} />
      <PageHeader
        title="Tổng quan hệ thống"
        description="Theo dõi toàn bộ hoạt động của hệ thống Smart Workflow"
        actions={
          <Button variant="ghost" onClick={fetchData} disabled={loading}>
            <Icon name="refresh" className={`text-[18px] ${loading ? 'spin' : ''}`} />
            Làm mới
          </Button>
        }
      />

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải tổng quan..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchData}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          {/* 4 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-stack-gap">
            <StatCard
              label="Tổng số dự án"
              value={projects?.total}
              icon="folder"
              to={ROUTE_PATHS.admin.projects}
              hint={
                projects
                  ? `${projects.active} đang hoạt động · ${projects.closed} đã đóng`
                  : null
              }
            />
            <StatCard
              label="Dự án đang hoạt động"
              value={projects?.active}
              icon="play_circle"
              accent="text-success-600"
              to={ROUTE_PATHS.admin.projects}
            />
            <StatCard
              label="Tổng số công việc"
              value={tasks?.total_visible}
              icon="task_alt"
              to={ROUTE_PATHS.admin.stats}
              hint={
                tasks
                  ? `${tasks.done} hoàn thành · ${tasks.in_progress + tasks.review} đang chạy`
                  : null
              }
            />
            <StatCard
              label="Công việc quá hạn"
              value={tasks?.overdue}
              icon="warning"
              accent="text-danger-500"
              to={ROUTE_PATHS.admin.stats}
              hint={tasks?.overdue > 0 ? 'Cần xử lý sớm' : 'Không có việc quá hạn'}
            />
          </div>

          {/* Snapshot nhân sự */}
          <Card>
            <CardHeader>
              <h3 className="text-h3 font-h3 text-on-surface">Nhân sự</h3>
              <Link
                to={ROUTE_PATHS.admin.users}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                Quản lý nhân sự →
              </Link>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-outline uppercase tracking-wide">Tổng</span>
                  <span className="text-2xl font-bold text-on-surface tabular-nums">
                    {users?.total ?? 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-outline uppercase tracking-wide">Admin</span>
                  <span className="text-2xl font-bold text-primary-700 tabular-nums">
                    {users?.admins ?? 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-outline uppercase tracking-wide">
                    Đang hoạt động
                  </span>
                  <span className="text-2xl font-bold text-success-600 tabular-nums">
                    {users?.active ?? 0}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-outline uppercase tracking-wide">Đã khóa</span>
                  <span className="text-2xl font-bold text-danger-500 tabular-nums">
                    {users?.inactive ?? 0}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 2 widget song song: Top dự án + Top workload */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-gap">
            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">
                  Dự án hoạt động nhiều nhất
                </h3>
                <span className="text-xs text-outline">Top 5 theo số task</span>
              </CardHeader>
              <CardBody>
                {topProjects.length === 0 ? (
                  <div className="text-sm text-outline text-center py-6">
                    Chưa có dự án nào đang hoạt động.
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {topProjects.map((p) => {
                      const pct =
                        p.total_tasks > 0
                          ? Math.round((p.done_tasks * 100) / p.total_tasks)
                          : 0
                      return (
                        <li key={p.id}>
                          <Link
                            to={ROUTE_PATHS.project.board(p.id)}
                            className="flex items-center gap-3 py-3 hover:bg-neutral-50 -mx-2 px-2 rounded transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-on-surface truncate">
                                  {p.name}
                                </span>
                                <Pill tone={PROJECT_STATUS_TONE[p.status] ?? 'neutral'}>
                                  {p.project_code}
                                </Pill>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-success-600 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[11px] text-outline tabular-nums shrink-0">
                                  {p.done_tasks}/{p.total_tasks} ({pct}%)
                                </span>
                              </div>
                            </div>
                            <Icon name="chevron_right" className="text-outline shrink-0" />
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">
                  Thành viên tải công việc cao
                </h3>
                <span className="text-xs text-outline">Top 8 đang phụ trách</span>
              </CardHeader>
              <CardBody>
                {topWorkload.length === 0 ? (
                  <div className="text-sm text-outline text-center py-6">
                    Chưa có ai đang phụ trách công việc nào.
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-neutral-100">
                    {topWorkload.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <Avatar initials={makeInitials(u.full_name)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-on-surface truncate">
                            {u.full_name}
                          </span>
                          <span className="block text-[11px] text-outline truncate">
                            {u.email}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-primary-900 tabular-nums shrink-0">
                          {u.active_tasks}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="flex justify-end">
            <Link
              to={ROUTE_PATHS.admin.stats}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:underline"
            >
              <Icon name="analytics" className="text-[18px]" />
              Xem thống kê chi tiết
            </Link>
          </div>
        </>
      )}
    </>
  )
}
