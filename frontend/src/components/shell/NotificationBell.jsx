import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useNotifications } from '../../context/NotificationContext'
import { ROUTE_PATHS } from '../../router/paths'
import { describeNotification, formatRelativeTime } from '../../utils/notificationFormat'

const TONE_CLS = {
  primary: 'bg-primary-50 text-primary-700 border-primary-100',
  success: 'bg-success-50 text-success-600 border-success-600/20',
  warning: 'bg-tertiary-50 text-tertiary-700 border-tertiary-300',
  danger: 'bg-danger-50 text-danger-500 border-danger-500/20',
  info: 'bg-secondary-50 text-secondary-700 border-secondary-100',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
}

function NotificationItem({ n, onClick }) {
  const meta = describeNotification(n)
  const cls = TONE_CLS[meta.tone] ?? TONE_CLS.neutral
  const projectId = n.project_id
  const to = projectId ? ROUTE_PATHS.project.board(projectId) : ROUTE_PATHS.notifications

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors border-l-4 ${
        n.is_read ? 'border-transparent' : 'border-primary-container bg-primary-50/40'
      }`}
    >
      <div
        className={`shrink-0 w-9 h-9 rounded-full border ${cls} flex items-center justify-center`}
      >
        <Icon name={meta.icon} className="text-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-on-surface line-clamp-2">{meta.title}</div>
        {meta.description ? (
          <div className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
            {meta.description}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-[11px] text-outline mt-1">
          {n.project_code ? (
            <span className="font-semibold">{n.project_code}</span>
          ) : null}
          {n.project_code ? <span>·</span> : null}
          <span>{formatRelativeTime(n.created_at)}</span>
        </div>
      </div>
      {!n.is_read ? (
        <span className="shrink-0 w-2 h-2 rounded-full bg-primary-container mt-2" aria-label="Chưa đọc" />
      ) : null}
    </Link>
  )
}

export function NotificationBell() {
  const { items, unreadCount, markAsRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  // Đóng dropdown khi click ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const recent = items.slice(0, 8)
  const hasUnread = unreadCount > 0

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-outline relative"
        title="Thông báo"
        aria-label={hasUnread ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
      >
        <Icon name="notifications" filled={hasUnread} />
        {hasUnread ? (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col fade-in">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-25">
            <h3 className="font-semibold text-on-surface">Thông báo</h3>
            <div className="flex items-center gap-1">
              {hasUnread ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-primary-700 hover:underline px-2 py-1"
                >
                  Đánh dấu đã đọc
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 max-h-[420px] overflow-y-auto scrollbar-thin divide-y divide-neutral-100">
            {recent.length === 0 ? (
              <div className="px-6 py-12 flex flex-col items-center text-center text-on-surface-variant">
                <Icon name="notifications_off" className="text-3xl text-outline mb-2" />
                <p className="text-sm">Chưa có thông báo nào</p>
                <p className="text-xs text-outline mt-1">
                  Bạn sẽ nhận thông báo realtime khi có hoạt động mới.
                </p>
              </div>
            ) : (
              recent.map((n) => (
                <NotificationItem
                  key={n.id}
                  n={n}
                  onClick={() => {
                    markAsRead(n.id)
                    setOpen(false)
                  }}
                />
              ))
            )}
          </div>

          {items.length > 0 ? (
            <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-25 text-center">
              <Link
                to={ROUTE_PATHS.notifications}
                onClick={() => setOpen(false)}
                className="text-xs font-semibold text-primary-700 hover:underline"
              >
                Xem tất cả thông báo
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
