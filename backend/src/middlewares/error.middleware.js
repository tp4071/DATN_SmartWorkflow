/**
 * Middleware xử lý lỗi tập trung.
 * Phải đăng ký cuối cùng trong chuỗi middleware.
 */
export const errorHandler = (err, req, res, _next) => {
  console.error('Unhandled Error:', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Lỗi hệ thống, vui lòng thử lại sau';

  const body = {
    success: false,
    error: message,
    statusCode
  };

  if (err.isOperational && err.details) {
    body.details = err.details;
  }

  return res.status(statusCode).json(body);
};
