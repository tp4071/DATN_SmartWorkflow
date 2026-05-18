import rateLimit from 'express-rate-limit';

/**
 * Rate limit cho /api/auth/login — chống brute-force credential stuffing.
 * 10 lần/phút/IP. Trả 429 với JSON đúng format response chuẩn.
 *
 * Lưu ý: backend chạy sau Vite proxy ở dev, IP có thể là 127.0.0.1 cho mọi request.
 * Khi deploy sau reverse proxy (nginx, Cloudflare), bật `app.set('trust proxy', 1)`
 * trong server.js để rateLimit lấy được client IP thật từ X-Forwarded-For.
 */
export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại.',
    statusCode: 429,
  },
});

/**
 * Rate limit chung cho mọi API authenticated, áp dụng ở scope toàn cục để bảo vệ
 * khỏi spam (vd: bot tạo task, gửi comment liên tục). Cao hơn login limit.
 *  - 300 request / phút / IP.
 */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Quá nhiều yêu cầu, vui lòng thử lại sau ít phút.',
    statusCode: 429,
  },
});
