import { request } from './http'

/**
 * PUT /api/me/password — đổi mật khẩu cho user hiện tại.
 * Backend yêu cầu mật khẩu mới ≥ 6 ký tự và khác mật khẩu cũ.
 */
export async function changeMyPassword({ currentPassword, newPassword }) {
  await request('/api/me/password', {
    method: 'PUT',
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  })
  return true
}
