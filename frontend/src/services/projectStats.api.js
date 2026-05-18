import { request } from './http'

export async function getProjectStatistics(projectId) {
  const res = await request(`/api/projects/${projectId}/statistics`)
  return res?.data ?? { byStatus: [], byAssignee: [] }
}
