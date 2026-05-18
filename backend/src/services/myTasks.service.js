import * as TaskRepository from '../repositories/task.repository.js';
import { STATUS_VALUES } from './task/task.constants.js';
import { createError } from './shared/errors.js';

const ALLOWED_DUE_FILTERS = new Set(['overdue', 'today', 'this_week', 'no_due']);

/**
 * UC mới — "Công việc của tôi" (cross-project).
 * Liệt kê toàn bộ task được giao cho user hiện tại trên mọi dự án mà user là thành viên,
 * không phụ thuộc projectId. Có hỗ trợ filter status và due.
 *
 * @param {string} userId - id user lấy từ JWT.
 * @param {{ status?: string, due?: string }} options
 */
export const listMyTasks = async (userId, { status, due } = {}) => {
  let statusFilter;
  if (status !== undefined && status !== null && status !== '') {
    if (!STATUS_VALUES.includes(status)) {
      throw createError('status không hợp lệ', 400);
    }
    if (status === 'Chờ duyệt') {
      // Đề xuất chưa duyệt không thuộc phạm vi "việc cần làm".
      throw createError('status "Chờ duyệt" không hợp lệ trong danh sách công việc của tôi', 400);
    }
    statusFilter = status;
  }

  let dueFilter;
  if (due !== undefined && due !== null && due !== '') {
    if (!ALLOWED_DUE_FILTERS.has(due)) {
      throw createError('due không hợp lệ. Cho phép: overdue, today, this_week, no_due', 400);
    }
    dueFilter = due;
  }

  const [tasks, statusCounts] = await Promise.all([
    TaskRepository.findTasksByAssignee(userId, { statusFilter, dueFilter }),
    TaskRepository.countTasksByAssigneeGroupedByStatus(userId)
  ]);

  return { tasks, statusCounts };
};
