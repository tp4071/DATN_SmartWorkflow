import { request } from './http'

export async function listUsers() {
  const res = await request('/api/users')
  return res?.data ?? []
}

export async function createUser({ fullName, email, password, systemRole }) {
  const res = await request('/api/users', {
    method: 'POST',
    body: {
      full_name: fullName,
      email,
      password,
      system_role: systemRole,
    },
  })
  return res?.data
}

export async function updateUser(id, { fullName, email, systemRole }) {
  const res = await request(`/api/users/${id}`, {
    method: 'PUT',
    body: {
      full_name: fullName,
      email,
      system_role: systemRole,
    },
  })
  return res?.data
}

export async function toggleUserStatus(id) {
  const res = await request(`/api/users/${id}/status`, {
    method: 'PUT',
  })
  // Trả cả user và details (releasedTasks summary cho UI).
  return {
    user: res?.data,
    details: res?.details ?? null,
    message: res?.message ?? null,
  }
}

export async function bulkCreateUsers(users) {
  const res = await request('/api/users/bulk', {
    method: 'POST',
    body: { users },
  })
  return res?.data
}

export async function resetUserPassword(id) {
  const res = await request(`/api/users/${id}/reset-password`, {
    method: 'PUT',
  })
  // res.data = { user: { id, email, full_name }, newPassword }
  return res?.data
}
