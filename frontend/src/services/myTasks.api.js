import { request } from './http'

/**
 * GET /api/me/tasks?status=&due=
 * Trả về { tasks, statusCounts } — task được giao cho user hiện tại trên mọi project.
 */
export async function listMyTasks({ status, due } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (due) params.set('due', due)
  const qs = params.toString() ? `?${params}` : ''
  const res = await request(`/api/me/tasks${qs}`)
  return res?.data ?? { tasks: [], statusCounts: {} }
}
