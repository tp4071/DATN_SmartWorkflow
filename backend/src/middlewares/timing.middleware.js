/**
 * Log thời gian xử lý từng request: METHOD path STATUS - <ms>ms.
 * Dùng để chẩn đoán độ trễ; có thể tắt bằng env DEBUG_TIMING=false.
 */
export const timing = (req, res, next) => {
  if (process.env.DEBUG_TIMING === 'false') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const tag = ms > 500 ? '🐢' : ms > 200 ? '⏱' : '⚡';
    console.log(`${tag} ${req.method} ${req.originalUrl} ${res.statusCode} - ${ms.toFixed(0)}ms`);
  });
  next();
};
