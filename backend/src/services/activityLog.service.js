import * as ActivityLogRepository from '../repositories/activityLog.repository.js';
import * as TaskRepository from '../repositories/task.repository.js';
import { createError } from './shared/errors.js';

const TASK_LOG_LIMIT = 200;
const DEFAULT_PROJECT_LIMIT = 50;
const MAX_PROJECT_LIMIT = 200;

const parsePositiveInt = (raw, { fallback, min, max, fieldName }) => {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const num = Number.parseInt(raw, 10);
  if (Number.isNaN(num) || num < min || num > max) {
    throw createError(`${fieldName} phải là số nguyên trong khoảng [${min}, ${max}]`, 400);
  }
  return num;
};

const validateActionFilter = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!ActivityLogRepository.ACTION_VALUES.includes(raw)) {
    throw createError(
      `action không hợp lệ. Hỗ trợ: ${ActivityLogRepository.ACTION_VALUES.join(', ')}`,
      400
    );
  }
  return raw;
};

/**
 * Lịch sử hoạt động của 1 task (cho trang chi tiết task).
 */
export const listLogsForTask = async (projectId, taskId) => {
  const task = await TaskRepository.findByIdInProject(taskId, projectId);
  if (!task) {
    throw createError('Không tìm thấy công việc trong dự án này', 404);
  }
  return ActivityLogRepository.findByTaskId(task.id, TASK_LOG_LIMIT);
};

/**
 * Audit feed cấp project (cho dashboard/PM).
 * Query params: action, limit, offset.
 */
export const listLogsForProject = async (projectId, query = {}) => {
  const actionFilter = validateActionFilter(query.action);
  const limit = parsePositiveInt(query.limit, {
    fallback: DEFAULT_PROJECT_LIMIT,
    min: 1,
    max: MAX_PROJECT_LIMIT,
    fieldName: 'limit'
  });
  const offset = parsePositiveInt(query.offset, {
    fallback: 0,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    fieldName: 'offset'
  });

  const [items, total] = await Promise.all([
    ActivityLogRepository.findByProjectId(projectId, { actionFilter, limit, offset }),
    ActivityLogRepository.countByProjectId(projectId, { actionFilter })
  ]);

  return {
    items,
    pagination: { total, limit, offset }
  };
};
