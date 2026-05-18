import bcrypt from 'bcrypt';
import * as UserRepository from '../repositories/user.repository.js';
import { createError } from './shared/errors.js';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 6;

/**
 * Đổi mật khẩu cho chính user hiện tại.
 *  - currentPassword: bắt buộc; phải khớp password_hash hiện tại.
 *  - newPassword: bắt buộc; ≥ 6 ký tự; phải khác currentPassword.
 *
 * Lưu ý: hệ thống dùng JWT stateless, KHÔNG có blacklist, nên các JWT cũ vẫn
 * còn hiệu lực đến khi hết hạn (24h). Nếu cần invalidate ngay, sau này có
 * thể triển khai password_changed_at + check trong middleware authenticate.
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw createError('Vui lòng nhập mật khẩu hiện tại', 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LEN) {
    throw createError(`Mật khẩu mới phải có tối thiểu ${MIN_PASSWORD_LEN} ký tự`, 400);
  }
  if (newPassword === currentPassword) {
    throw createError('Mật khẩu mới phải khác mật khẩu hiện tại', 400);
  }

  const user = await UserRepository.findByIdWithPassword(userId);
  if (!user) {
    throw createError('Không tìm thấy tài khoản', 404);
  }

  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) {
    throw createError('Mật khẩu hiện tại không đúng', 400);
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserRepository.updatePasswordHash(userId, newHash);
  return true;
};
