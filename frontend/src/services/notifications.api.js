import { request } from './http'

export async function listNotifications({ limit = 30, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit, offset }).toString()
  const res = await request(`/api/notifications?${qs}`)
  return res?.data ?? { items: [], unreadCount: 0 }
}

export async function getUnreadCount() {
  const res = await request('/api/notifications/unread-count')
  return res?.data?.count ?? 0
}

export async function markAllNotificationsRead() {
  const res = await request('/api/notifications/mark-all-read', { method: 'PUT' })
  return res?.data
}
