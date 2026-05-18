import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Breadcrumb,
  Button,
  EmptyState,
  FilterBar,
  Icon,
  PageHeader,
  Select,
  Spinner,
} from '../components/ui'
import { useNotifications } from '../context/NotificationContext'
import { ROUTE_PATHS } from '../router/paths'
import {
  describeNotification,
  formatRelativeTime,
  ACTION_FILTER_OPTIONS,
} from '../utils/notificationFormat'

const TONE_CLS = {
  primary: 'bg-primary-50 text-primary-700 border-primary-100',
  success: 'bg-success-50 text-success-600 border-success-600/20',
  warning: 'bg-tertiary-50 text-tertiary-700 border-tertiary-300',
  danger: 'bg-danger-50 text-danger-500 border-danger-500/20',
  info: 'bg-secondary-50 text-secondary-700 border-secondary-100',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

export function NotificationsPage() {
  const { items, unreadCount, loading, error, markAsRead, markAllRead, remove } =
    useNotifications()
  const [filter, setFilter] = useState('ALL')

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items
    if (filter === 'UNREAD') return items.filter((n) => !n.is_read)
    return items.filter((n) => n.action === filter)
  }, [items, filter])

  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ' }, { label: 'Thông báo' }]} />
      <PageHeader
        title="Thông báo"
        description="Lịch sử thông báo từ hoạt động trong các dự án bạn tham gia. Hệ thống dùng activity_logs để lưu trữ — bạn vẫn xem được khi đăng nhập lại."
        actions={
          unreadCount > 0 ? (
            <Button variant="ghost" onClick={markAllRead}>
              <Icon name="done_all" className="text-[18px]" />
              Đánh dấu tất cả đã đọc
            </Button>
          ) : null
        }
      />

      <FilterBar
        right={
          <span className="text-xs text-outline">
            {filtered.length} / {items.length} · {unreadCount} chưa đọc
          </span>
        }
      >
        <Select
          value={filter}
          onChange={setFilter}
          options={ACTION_FILTER_OPTIONS}
          ariaLabel="Lọc thông báo"
          widthClass="w-full sm:w-64"
        />
      </FilterBar>

      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-lg p-12 flex justify-center">
          <Spinner size="lg" label="Đang tải thông báo..." />
        </div>
      ) : error ? (
        <EmptyState icon="error" title="Không tải được thông báo" description={error} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications_off"
          title="Chưa có thông báo nào"
          description="Khi có hoạt động liên quan đến công việc bạn phụ trách hoặc dự án bạn quản lý, thông báo sẽ xuất hiện ở đây."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="filter_alt_off"
          title="Không có thông báo khớp bộ lọc"
          description="Đổi bộ lọc khác để xem các thông báo còn lại."
          action={
            <Button variant="ghost" onClick={() => setFilter('ALL')}>
              Bỏ bộ lọc
            </Button>
          }
        />
      ) : (
        <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100 overflow-hidden">
          {filtered.map((n) => {
            const meta = describeNotification(n)
            const cls = TONE_CLS[meta.tone] ?? TONE_CLS.neutral
            const projectId = n.project_id
            const to = projectId
              ? ROUTE_PATHS.project.board(projectId)
              : ROUTE_PATHS.notifications
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                  n.is_read ? '' : 'bg-primary-50/30'
                } hover:bg-neutral-50`}
              >
                <div
                  className={`shrink-0 w-10 h-10 rounded-full border ${cls} flex items-center justify-center`}
                >
                  <Icon name={meta.icon} className="text-[20px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={to}
                    onClick={() => markAsRead(n.id)}
                    className="text-sm text-on-surface hover:text-primary-700 transition-colors"
                  >
                    {meta.title}
                  </Link>
                  {meta.description ? (
                    <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {meta.description}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-[11px] text-outline mt-1.5">
                    {n.project_code ? (
                      <span className="font-semibold">{n.project_code}</span>
                    ) : null}
                    {n.project_name ? (
                      <span className="truncate">· {n.project_name}</span>
                    ) : null}
                    <span>·</span>
                    <span>{formatRelativeTime(n.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      title="Đánh dấu đã đọc"
                      className="p-1.5 text-outline hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                    >
                      <Icon name="done" className="text-[18px]" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    title="Ẩn khỏi danh sách"
                    className="p-1.5 text-outline hover:text-danger-500 hover:bg-danger-50 rounded transition-colors"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
