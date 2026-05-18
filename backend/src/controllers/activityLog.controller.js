import * as ActivityLogService from '../services/activityLog.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

/**
 * GET /api/projects/:projectId/tasks/:taskId/activity-logs
 * Lịch sử thay đổi của 1 task (sort mới nhất trước, cap 200).
 */
export const listForTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const logs = await ActivityLogService.listLogsForTask(req.projectId, taskId);

    return res.status(200).json({
      success: true,
      data: logs,
      message: 'Lấy lịch sử hoạt động thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/activity-logs?action=&limit=&offset=
 * Audit feed cấp project (cho dashboard PM).
 */
export const listForProject = async (req, res, next) => {
  try {
    const result = await ActivityLogService.listLogsForProject(req.projectId, req.query);

    return res.status(200).json({
      success: true,
      data: result.items,
      message: `Lấy ${result.items.length}/${result.pagination.total} hoạt động`,
      meta: result.pagination
    });
  } catch (err) {
    return next(err);
  }
};
