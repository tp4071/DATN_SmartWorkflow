import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SECRET_KEY;

if (!JWT_SECRET) {
  throw new Error('SECRET_KEY environment variable is required');
}

/**
 * Middleware xác thực JWT token.
 * Gắn thông tin user (id, email, system_role) vào req.user.
 */
export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Không tìm thấy token xác thực',
      statusCode: 401
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Token không hợp lệ hoặc đã hết hạn',
      statusCode: 401
    });
  }
};

/**
 * Middleware kiểm tra quyền ADMIN.
 * Phải đặt sau middleware authenticate.
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Không tìm thấy thông tin người dùng',
      statusCode: 401
    });
  }

  if (req.user.system_role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Bạn không có quyền truy cập chức năng này',
      statusCode: 403
    });
  }
  next();
};
