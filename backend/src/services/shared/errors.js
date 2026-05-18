/**
 * Tạo operational error có statusCode để middleware errorHandler xử lý nhất quán.
 */
export const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};
