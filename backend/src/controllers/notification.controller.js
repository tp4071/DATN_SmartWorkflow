import * as ActivityLogRepository from '../repositories/activityLog.repository.js';
import * as UserRepository from '../repositories/user.repository.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const parseLimit = (raw) => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
};

const parseOffset = (raw) => {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

/**
 * GET /api/notifications?limit=&offset=
 */
export const list = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const offset = parseOffset(req.query.offset);

    const [items, unreadCount] = await Promise.all([
      ActivityLogRepository.findNotificationsForUser(req.user.id, { limit, offset }),
      ActivityLogRepository.countUnreadForUser(req.user.id),
    ]);

    return res.status(200).json({
      success: true,
      data: { items, unreadCount, limit, offset },
      message: 'Lấy danh sách thông báo thành công',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 */
export const unreadCount = async (req, res, next) => {
  try {
    const count = await ActivityLogRepository.countUnreadForUser(req.user.id);
    return res.status(200).json({
      success: true,
      data: { count },
      message: 'OK',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/mark-all-read
 */
export const markAllRead = async (req, res, next) => {
  try {
    const seenAt = await UserRepository.markAllNotificationsSeen(req.user.id);
    return res.status(200).json({
      success: true,
      data: { notifications_seen_at: seenAt },
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    });
  } catch (err) {
    next(err);
  }
};
