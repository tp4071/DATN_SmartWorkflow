import { Avatar, Icon, PriorityBadge } from '../ui'
import { useAuth } from '../../context/useAuth'

function makeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'Hoàn thành') return false
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

/**
 * Compact task card cho Kanban board.
 *  - Highlight (border + chip "Của bạn") khi assignee_id === user hiện tại.
 *  - Hiện title, description preview, priority, assignee, due date.
 *  - Đỏ nếu quá hạn.
 *  - Badge "AI" khi is_ai_generated.
 */
export function TaskCard({ task, onClick }) {
  const { user } = useAuth()
  const due = formatDate(task.due_date)
  const overdue = isOverdue(task.due_date, task.status)
  const isMine = !!user?.id && task.assignee_id === user.id

  return (
    <article
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={`task-card bg-white border rounded-lg p-3 flex flex-col gap-2 hover:shadow-sm transition-all ${
        isMine
          ? 'border-l-4 border-primary-container border-t-neutral-200 border-r-neutral-200 border-b-neutral-200 hover:border-primary-700'
          : 'border-neutral-200 hover:border-primary-300'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-on-surface line-clamp-2 flex-1">
          {task.title}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          {isMine ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-50 text-primary-900 border border-primary-100"
              title="Bạn là người phụ trách công việc này"
            >
              <Icon name="person" className="text-[12px]" />
              Của bạn
            </span>
          ) : null}
          {task.is_ai_generated ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary-50 text-secondary-700 border border-secondary-100"
              title="Sinh bằng AI"
            >
              <Icon name="auto_awesome" className="text-[12px]" />
              AI
            </span>
          ) : null}
        </div>
      </div>

      {task.description ? (
        <p className="text-xs text-on-surface-variant line-clamp-2">{task.description}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-xs">
        <PriorityBadge priority={task.priority} />
        {due ? (
          <span
            className={`inline-flex items-center gap-1 ${
              overdue ? 'text-danger-500 font-semibold' : 'text-on-surface-variant'
            }`}
            title={overdue ? 'Đã quá hạn' : 'Hạn hoàn thành'}
          >
            <Icon name={overdue ? 'event_busy' : 'event'} className="text-[14px]" />
            {due}
          </span>
        ) : null}
      </div>

      {task.assignee_name ? (
        <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
          <Avatar initials={makeInitials(task.assignee_name)} size="xs" />
          <span className="text-xs text-on-surface-variant truncate">{task.assignee_name}</span>
        </div>
      ) : task.status === 'Đang làm' || task.status === 'Chờ đánh giá' ? (
        // Task ĐANG dang dở nhưng mất assignee (thường do tài khoản bị khóa) -> cảnh báo PM
        <div className="flex items-center gap-2 pt-1 border-t border-danger-500/30">
          <div className="w-6 h-6 rounded-full bg-danger-50 text-danger-500 flex items-center justify-center">
            <Icon name="person_alert" className="text-[12px]" />
          </div>
          <span className="text-xs text-danger-500 font-semibold truncate">
            Cần phân công lại
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1 border-t border-neutral-100">
          <div className="w-6 h-6 rounded-full bg-neutral-100 text-outline flex items-center justify-center">
            <Icon name="person_off" className="text-[12px]" />
          </div>
          <span className="text-xs text-outline italic">Chưa phân công</span>
        </div>
      )}
    </article>
  )
}
