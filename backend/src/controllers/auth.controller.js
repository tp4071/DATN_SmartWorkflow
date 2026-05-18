import * as AuthService from '../services/auth.service.js';

/**
 * POST /api/auth/login
 * Đăng nhập hệ thống.
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email và mật khẩu là bắt buộc',
        statusCode: 400
      });
    }

    const result = await AuthService.login(email, password);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Đăng nhập thành công'
    });
  } catch (err) {
    next(err);
  }
};
