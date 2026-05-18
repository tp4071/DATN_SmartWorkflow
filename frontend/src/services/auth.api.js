import { request } from './http'

export async function loginRequest({ email, password }) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  return res?.data
}
