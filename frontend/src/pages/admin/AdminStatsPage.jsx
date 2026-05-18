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
import { getSystemOverview } from '../../services/admin.api'

const STATUS_META = {
  'Chờ duyệt': { hex: '#8a4cfc', key: 'proposed' },
  'Cần làm': { hex: '#757682', key: 'todo' },
  'Đang làm': { hex: '#1e3a8a', key: 'in_progress' },
  'Chờ đánh giá': { hex: '#FB923C', key: 'review' },
  'Hoàn thành': { hex: '#15803D', key: 'done' },
}

const PROJECT_STATUS_META = {
  'Đang hoạt động': { hex: '#15803D', key: 'active' },
  'Đóng': { hex: '#757682', key: 'closed' },
  'Lưu trữ': { hex: '#FB923C', key: 'archived' },
}

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

export function AdminStatsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setData(await getSystemOverview())
    } catch (err) {
      setLoadError(err.message || 'Không tải được số liệu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const taskDonut = useMemo(() => {
    if (!data?.tasks) return []
    return Object.entries(STATUS_META).map(([label, meta]) => ({
      key: label,
      label,
      value: data.tasks[meta.key] ?? 0,
      colorHex: meta.hex,
    }))
  }, [data])

  const projectDonut = useMemo(() => {
    if (!data?.projects) return []
    return Object.entries(PROJECT_STATUS_META).map(([label, meta]) => ({
      key: label,
      label,
      value: data.projects[meta.key] ?? 0,
      colorHex: meta.hex,
    }))
  }, [data])

  const workloadBars = useMemo(
    () =>
      (data?.topWorkload ?? []).map((u, i) => ({
        key: u.id,
        label: u.full_name,
        value: u.active_tasks,
        colorHex: ASSIGNEE_PALETTE[i % ASSIGNEE_PALETTE.length],
      })),
    [data],
  )

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Trang chủ', to: ROUTE_PATHS.admin.dashboard },
          { label: 'Thống kê hệ thống' },
        ]}
      />
      <PageHeader
        title="Thống kê hệ thống"
        description="Phân bổ task theo trạng thái, vòng đời dự án và tải công việc theo từng thành viên trong toàn hệ thống."
        actions={
          <Button variant="ghost" onClick={fetchData} disabled={loading}>
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
          title="Không tải được dữ liệu"
          description={loadError}
          action={
            <Button variant="ghost" onClick={fetchData}>
              <Icon name="refresh" className="text-[18px]" />
              Thử lại
            </Button>
          }
        />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-stack-gap">
            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">Phân bổ công việc</h3>
                <span className="text-xs text-outline">Theo trạng thái — toàn hệ thống</span>
              </CardHeader>
              <CardBody>
                <DonutChart data={taskDonut} centerSubLabel="task" />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">Vòng đời dự án</h3>
                <span className="text-xs text-outline">Đang hoạt động / Đóng / Lưu trữ</span>
              </CardHeader>
              <CardBody>
                <DonutChart data={projectDonut} centerSubLabel="dự án" />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h3 className="text-h3 font-h3 text-on-surface">
                Tải công việc theo thành viên
              </h3>
              <span className="text-xs text-outline">
                Đang phụ trách (Cần làm + Đang làm + Chờ đánh giá), top 8
              </span>
            </CardHeader>
            <CardBody>
              {workloadBars.length === 0 ? (
                <div className="text-sm text-outline text-center py-8">
                  Chưa có ai đang phụ trách công việc nào trong hệ thống.
                </div>
              ) : (
                <HorizontalBarChart data={workloadBars} />
              )}
            </CardBody>
          </Card>

          {workloadBars.length > 0 ? (
            <Card>
              <CardHeader>
                <h3 className="text-h3 font-h3 text-on-surface">Bảng chi tiết</h3>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-neutral-50 border-y border-neutral-200 text-xs uppercase text-neutral-700">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Thành viên</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold text-right">Đang phụ trách</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-neutral-200">
                    {data.topWorkload.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar initials={makeInitials(u.full_name)} size="sm" />
                            <span className="font-medium text-on-surface">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-on-surface-variant">{u.email}</td>
                        <td className="px-6 py-3 text-right tabular-nums font-semibold">
                          {u.active_tasks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  )
}
