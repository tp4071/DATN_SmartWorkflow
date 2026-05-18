/**
 * Map activity_logs.action + old/new value -> label/icon/tone hiển thị.
 *
 * Backend trả về 1 row enriched có shape:
 *   { id, action, old_value, new_value, created_at, task_id, task_title,
 *     project_id, project_name, project_code, actor_id, actor_name, ...,
 *     is_read, ephemeral? }
 *
 * Đối với STATUS_CHANGED, ý nghĩa thông báo phụ thuộc cặp (old_value, new_value):
 *   - 'Chờ duyệt' -> 'Cần làm'        : đề xuất được duyệt
 *   - 'Đang làm'  -> 'Chờ đánh giá'   : member nộp nghiệm thu (gửi tới PM)
 *   - 'Chờ đánh giá' -> 'Hoàn thành'  : nghiệm thu thành công
 *   - 'Chờ đánh giá' -> 'Đang làm'    : trả về làm lại
 *   - các cặp khác                    : đổi trạng thái thông thường
 */
const TONES = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
}

function statusChangedDisplay(n) {
  const o = n.old_value
  const v = n.new_value
  const title = (text) => ({ icon: 'sync', tone: TONES.primary, title: text })
  const taskTitle = n.task_title ?? '...'

  if (o === 'Chờ duyệt' && v === 'Cần làm') {
    return {
      icon: 'verified',
      tone: TONES.success,
      title: `Đề xuất "${taskTitle}" đã được phê duyệt`,
    }
  }
  if (o === 'Đang làm' && v === 'Chờ đánh giá') {
    return {
      icon: 'fact_check',
      tone: TONES.warning,
      title: `Có công việc chờ nghiệm thu: "${taskTitle}"`,
    }
  }
  if (o === 'Chờ đánh giá' && v === 'Hoàn thành') {
    return {
      icon: 'task_alt',
      tone: TONES.success,
      title: `Công việc "${taskTitle}" đã được nghiệm thu`,
    }
  }
  if (o === 'Chờ đánh giá' && v === 'Đang làm') {
    return {
      icon: 'undo',
      tone: TONES.danger,
      title: `Công việc "${taskTitle}" bị trả về làm lại`,
    }
  }
  return title(`"${taskTitle}" chuyển từ "${o ?? '?'}" sang "${v ?? '?'}"`)
}

export function describeNotification(n) {
  if (!n) return { icon: 'notifications', tone: TONES.neutral, title: 'Thông báo' }

  const taskTitle = n.task_title ?? '...'
  const actorName = n.actor_name ?? 'Có người'

  switch (n.action) {
    case 'STATUS_CHANGED':
      return statusChangedDisplay(n)

    case 'ASSIGNEE_CHANGED': {
      const newName = n.new_assignee_name
      const oldName = n.old_assignee_name
      if (newName && !oldName) {
        return {
          icon: 'assignment_ind',
          tone: TONES.primary,
          title: `Bạn được giao công việc "${taskTitle}"`,
        }
      }
      if (oldName && !newName) {
        return {
          icon: 'person_remove',
          tone: TONES.neutral,
          title: `Bạn không còn phụ trách công việc "${taskTitle}"`,
        }
      }
      return {
        icon: 'swap_horiz',
        tone: TONES.primary,
        title: `Người phụ trách "${taskTitle}" đã thay đổi`,
      }
    }

    case 'PRIORITY_CHANGED':
      return {
        icon: 'priority_high',
        tone: TONES.warning,
        title: `Mức ưu tiên "${taskTitle}" đổi từ ${n.old_value ?? '?'} → ${n.new_value ?? '?'}`,
      }

    case 'DUE_DATE_CHANGED': {
      const fmt = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : 'không có')
      return {
        icon: 'event',
        tone: TONES.warning,
        title: `Hạn "${taskTitle}" đổi từ ${fmt(n.old_value)} → ${fmt(n.new_value)}`,
      }
    }

    case 'COMMENT_ADDED':
      return {
        icon: 'comment',
        tone: TONES.info,
        title: `${actorName} đã bình luận trong "${taskTitle}"`,
        description: n.new_value || null,
      }

    case 'MENTIONED_IN_COMMENT':
      return {
        icon: 'alternate_email',
        tone: TONES.primary,
        title: `${actorName} đã nhắc đến bạn trong "${taskTitle}"`,
      }

    case 'ASSIGNEE_UNLINKED_BY_LOCK': {
      const lockedName = n.old_assignee_name ?? 'Thành viên'
      return {
        icon: 'person_off',
        tone: TONES.danger,
        title: `Tài khoản "${lockedName}" đã bị khóa — công việc "${taskTitle}" cần phân công lại`,
      }
    }

    case 'ATTACHMENT_ADDED':
      return {
        icon: 'attach_file',
        tone: TONES.info,
        title: `${actorName} đính kèm tài liệu vào "${taskTitle}"${n.new_value ? `: ${n.new_value}` : ''}`,
      }

    case 'PROPOSAL_REJECTED':
      return {
        icon: 'block',
        tone: TONES.danger,
        title: `Đề xuất "${taskTitle}" đã bị từ chối`,
      }

    default:
      return {
        icon: 'notifications',
        tone: TONES.neutral,
        title: `Hoạt động mới trên "${taskTitle}"`,
      }
  }
}

export function formatRelativeTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diffSec = Math.round((Date.now() - t) / 1000)
  if (diffSec < 5) return 'vừa xong'
  if (diffSec < 60) return `${diffSec}s trước`
  const diffMin = Math.floor(diffSec / 60)
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

/**
 * Action options (cho Select bộ lọc trên NotificationsPage).
 */
export const ACTION_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'UNREAD', label: 'Chưa đọc' },
  { value: 'STATUS_CHANGED', label: 'Đổi trạng thái' },
  { value: 'ASSIGNEE_CHANGED', label: 'Đổi người phụ trách' },
  { value: 'PRIORITY_CHANGED', label: 'Đổi mức ưu tiên' },
  { value: 'DUE_DATE_CHANGED', label: 'Đổi hạn' },
  { value: 'COMMENT_ADDED', label: 'Bình luận mới' },
  { value: 'MENTIONED_IN_COMMENT', label: 'Được nhắc tên' },
  { value: 'ASSIGNEE_UNLINKED_BY_LOCK', label: 'Phụ trách bị khóa' },
  { value: 'ATTACHMENT_ADDED', label: 'Tài liệu mới' },
  { value: 'PROPOSAL_REJECTED', label: 'Đề xuất bị từ chối' },
]
