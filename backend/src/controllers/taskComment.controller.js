import * as TaskCommentService from '../services/taskComment.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

const validateTaskId = (taskId, res) => {
  if (!UUID_REGEX.test(taskId)) {
    badRequest(res, 'taskId không hợp lệ');
    return false;
  }
  return true;
};

/**
 * GET /api/projects/:projectId/tasks/:taskId/comments
 */
export const list = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!validateTaskId(taskId, res)) return undefined;

    const comments = await TaskCommentService.listComments(req.projectId, taskId);

    return res.status(200).json({
      success: true,
      data: comments,
      message: 'Lấy danh sách bình luận thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/:taskId/comments
 * Body: { content: string }
 */
export const create = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!validateTaskId(taskId, res)) return undefined;

    const { content, mentioned_user_ids: mentionedUserIds } = req.body || {};
    const comment = await TaskCommentService.createComment(
      req.projectId, taskId, req.user.id, content, mentionedUserIds
    );

    return res.status(201).json({
      success: true,
      data: comment,
      message: 'Tạo bình luận thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/comments/:commentId
 * Body: { content: string }
 * Hệ thống tự động bật is_edited = TRUE.
 */
export const update = async (req, res, next) => {
  try {
    const { taskId, commentId } = req.params;
    if (!validateTaskId(taskId, res)) return undefined;
    if (!UUID_REGEX.test(commentId)) {
      return badRequest(res, 'commentId không hợp lệ');
    }

    const { content } = req.body || {};
    const updated = await TaskCommentService.updateComment(
      req.projectId, taskId, commentId, req.user.id, content
    );

    return res.status(200).json({
      success: true,
      data: updated,
      message: 'Cập nhật bình luận thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId
 */
export const remove = async (req, res, next) => {
  try {
    const { taskId, commentId } = req.params;
    if (!validateTaskId(taskId, res)) return undefined;
    if (!UUID_REGEX.test(commentId)) {
      return badRequest(res, 'commentId không hợp lệ');
    }

    await TaskCommentService.deleteComment(
      req.projectId, taskId, commentId, req.user.id, req.projectRole
    );

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Đã xoá bình luận'
    });
  } catch (err) {
    return next(err);
  }
};
