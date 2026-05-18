import * as MyTasksService from '../services/myTasks.service.js';

/**
 * GET /api/me/tasks?status=&due=
 * Liệt kê task được giao cho user hiện tại (cross-project).
 */
export const listMyTasks = async (req, res, next) => {
  try {
    const { status, due } = req.query;
    const result = await MyTasksService.listMyTasks(req.user.id, { status, due });

    return res.status(200).json({
      success: true,
      data: result,
      message: `Có ${result.tasks.length} công việc đang được giao cho bạn`
    });
  } catch (err) {
    return next(err);
  }
};
