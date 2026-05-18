import { request } from './http'

export async function listProjects({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await request(`/api/projects${qs}`)
  return res?.data ?? []
}

export async function getProject(id) {
  const res = await request(`/api/projects/${id}`)
  return res?.data
}

export async function createProject({ projectCode, name, description, startDate, endDate, pmId }) {
  const res = await request('/api/projects', {
    method: 'POST',
    body: {
      project_code: projectCode,
      name,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      pm_id: pmId,
    },
  })
  return res?.data
}

export async function updateProject(id, { name, description, startDate, endDate, pmId }) {
  const res = await request(`/api/projects/${id}`, {
    method: 'PUT',
    body: {
      name,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      pm_id: pmId,
    },
  })
  return res?.data
}

export async function closeProject(id) {
  const res = await request(`/api/projects/${id}/close`, { method: 'PUT' })
  return res?.data
}
