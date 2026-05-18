import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  DonutChart,
  EmptyState,
  HorizontalBarChart,
  Icon,
  PageHeader,
  Spinner,
} from '../../components/ui'
import { ROUTE_PATHS } from '../../router/paths'
import { useProject } from '../../context/ProjectContext'
import { getProjectStatistics } from '../../services/projectStats.api'

// Status thật của hệ thống (5 trạng thái) + màu hiển thị thống nhất với Kanban.
const STATUS_META = {
  'Chờ duyệt': { hex: '#8a4cfc' },
  'Cần làm': { hex: '#757682' },
  'Đang làm': { hex: '#1e3a8a' },
  'Chờ đánh giá': { hex: '#FB923C' },
  'Hoàn thành': { hex: '#15803D' },
}

// Bảng màu chu kỳ cho bar (assignee). Lấy từ theme tokens trong index.html.
const ASSIGNEE_PALETTE = [
  '#1e3a8a',
  '#712ae2',
  '#FB923C',
  '#15803D',
  '#DC2626',
  '#3D3D43',
]

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function StatusKpi({ label, value, hex }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
        <span className="text-xs text-on-surface-variant uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-on-surface tabular-nums">{value}</div>
    </div>
  )
}

export function ProjectStatsPage() {
  const { project, projectId, canManage } = useProject()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getProjectStatistics(projectId)
      setStats(data)
    } catch (err) {
      setLoadError(err.message || 'Không tải được thống kê.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const totalTasks = useMemo(
    () => (stats?.byStatus ?? []).reduce((s, r) => s + (r.total || 0), 0),
    [stats],
  )

  const completionRate = useMemo(() => {
    if (!stats?.byStatus || totalTasks === 0) return 0
    const done = stats.byStatus.find((r) => r.status === 'Hoàn thành')?.total || 0
    return Math.round((done / totalTasks) * 100)
  }, [stats, totalTasks])

  const donutData = useMemo(() => {
    if (!stats?.byStatus) return []
    return stats.byStatus.map((row) => ({
      key: row.status,
      label: row.status,
      value: row.total,
      colorHex: STATUS_META[row.status]?.hex,
    }))
  }, [stats])

  const barData = useMemo(() => {
    if (!stats?.byAssignee) return []
    return stats.byAssignee.map((row, i) => ({
      key: row.assignee_id ?? `__unassigned__${i}`,
      label: row.assignee_name || 'Chưa phân công',
      value: row.total,
      colorHex: row.assignee_id
        ? ASSIGNEE_PALETTE[i % ASSIGNEE_PALETTE.length]
        : '#9CA3AF',
    }))
  }, [stats])

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
          { label: project?.name ?? 'Dự án', to: ROUTE_PATHS.project.board(projectId) },
          { label: 'Thống kê' },
        ]}
      />
      <PageHeader
        title="Thống kê dự án"
        description="Tổng quan trạng thái công việc và phân bổ khối lượng theo từng thành viên."
        actions={
          <Button variant="ghost" onClick={fetchStats} disabled={loading}>
            <Icon name="refresh" className={`text-[18px] ${loading ? 'spin' : ''}`} />
            Làm mới
          </Button>
        }
      />

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải thống kê..." />
        </div>
      ) : loadError ? (
        <EmptyState
          icon="error"
          title="Không tải được thống kê"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchStats}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : totalTasks === 0 ? (
        <EmptyState
          icon="bar_chart"
          title="Chưa có công việc nào để thống kê"
          description={
            canManage
              ? 'Tạo task đầu tiên cho dự án để bắt đầu theo dõi tiến độ.'
              : 'Khi dự án có task, biểu đồ sẽ xuất hiện tại đây.'
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {(stats?.byStatus ?? []).map((row) => (
              <StatusKpi
                key={row.status}
                label={row.status}
                value={row.total}
                hex={STATUS_META[row.status]?.hex || '#757682'}
              />
            ))}
            <div className="bg-success-50 border border-success-600/20 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Icon name="check_circle" filled className="text-success-600 text-[16px]" />
                <span className="text-xs text-success-600 uppercase tracking-wider">
                  Tỉ lệ hoàn thành
                </span>
              </div>
              <div className="text-2xl font-bold text-success-600 tabular-nums">
                {completionRate}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-gap">
            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">Phân bố theo trạng thái</h3>
                <span className="text-xs text-outline">{totalTasks} task</span>
              </CardHeader>
              <CardBody>
                <DonutChart data={donutData} centerSubLabel="task" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">
                  Khối lượng theo thành viên
                </h3>
                <span className="text-xs text-outline">
                  Đang phụ trách (chưa "Hoàn thành")
                </span>
              </CardHeader>
              <CardBody>
                {barData.length === 0 ? (
                  <div className="text-sm text-outline text-center py-8">
                    Tất cả công việc đã hoàn thành — không còn workload đang phụ trách.
                  </div>
                ) : (
                  <HorizontalBarChart data={barData} />
                )}
              </CardBody>
            </Card>
          </div>

          {barData.length > 0 ? (
            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">Chi tiết theo thành viên</h3>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-50 border-y border-neutral-200 text-xs uppercase text-neutral-700">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Thành viên</th>
                      <th className="px-6 py-3 font-semibold text-right">Đang phụ trách</th>
                      <th className="px-6 py-3 font-semibold text-right">% workload</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-neutral-200">
                    {(() => {
                      const sumActive =
                        barData.reduce((s, d) => s + (d.value || 0), 0) || 1
                      return barData.map((row) => (
                        <tr key={row.key} className="hover:bg-neutral-50">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {row.label === 'Chưa phân công' ? (
                                <div className="w-8 h-8 rounded-full bg-neutral-100 text-outline flex items-center justify-center">
                                  <Icon name="person_off" className="text-[18px]" />
                                </div>
                              ) : (
                                <Avatar initials={makeInitials(row.label)} size="sm" />
                              )}
                              <span className="font-medium text-on-surface">{row.label}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold">
                            {row.value}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-on-surface-variant">
                            {((row.value / sumActive) * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}
