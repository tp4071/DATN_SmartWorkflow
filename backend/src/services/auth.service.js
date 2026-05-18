import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as UserRepository from '../repositories/user.repository.js';

const JWT_SECRET = process.env.SECRET_KEY;

if (!JWT_SECRET) {
  throw new Error('SECRET_KEY environment variable is required');
}

const JWT_EXPIRES_IN = '24h';

/**
 * Xử lý logic đăng nhập.
 * Trả về JWT token nếu thành công.
 */
export const login = async (email, password) => {
  // 1. Kiểm tra tài khoản tồn tại
  const user = await UserRepository.findByEmail(email);

  if (!user) {
    const err = new Error('Email hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  // 2. Kiểm tra mật khẩu
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    const err = new Error('Email hoặc mật khẩu không chính xác');
    err.statusCode = 401;
    err.isOperational = true;
    throw err;
  }

  // 3. Kiểm tra trạng thái tài khoản
  if (user.status === 'Inactive') {
    const err = new Error('Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ Admin');
    err.statusCode = 403;
    err.isOperational = true;
    throw err;
  }

  // 4. Tạo JWT token
  const payload = {
    id: user.id,
    email: user.email,
    system_role: user.system_role
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      system_role: user.system_role
    }
  };
};
