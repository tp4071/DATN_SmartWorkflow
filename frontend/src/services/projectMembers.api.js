import { request } from './http'

export async function listProjectMembers(projectId) {
  const res = await request(`/api/projects/${projectId}/members`)
  return res?.data ?? []
}

export async function searchAvailableUsers(projectId, keyword) {
  const qs = keyword ? `?q=${encodeURIComponent(keyword)}` : ''
  const res = await request(`/api/projects/${projectId}/users/search${qs}`)
  return res?.data ?? []
}

export async function addProjectMember(projectId, userId) {
  const res = await request(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: { user_id: userId },
  })
  return res?.data
}

export async function removeProjectMember(projectId, userId) {
  const res = await request(`/api/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
  return res?.data
}
