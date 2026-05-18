import { request } from './http'

export async function getSystemOverview() {
  const res = await request('/api/admin/stats/overview')
  return res?.data
}
