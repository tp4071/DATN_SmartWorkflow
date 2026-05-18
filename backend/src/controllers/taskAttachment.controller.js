import * as TaskAttachmentService from '../services/taskAttachment.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

/**
 * GET /api/projects/:projectId/tasks/:taskId/attachments
 */
export const list = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const attachments = await TaskAttachmentService.listAttachments(req.projectId, taskId);

    return res.status(200).json({
      success: true,
      data: attachments,
      message: 'Lấy danh sách tài liệu thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/:taskId/attachments
 * Body: { file_name: string, file_url: string }
 */
export const add = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const { file_name, file_url } = req.body || {};

    const attachment = await TaskAttachmentService.addAttachment(
      req.projectId, taskId, req.user.id, file_name, file_url
    );

    return res.status(201).json({
      success: true,
      data: attachment,
      message: 'Đính kèm tài liệu thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/:taskId/attachments/upload  (multipart)
 * Field: file
 *
 * Backend nhận file → upload Supabase Storage → INSERT row → trả attachment đã tạo.
 */
export const upload = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }
    if (!req.file) {
      return badRequest(res, 'Vui lòng chọn file để upload');
    }

    const attachment = await TaskAttachmentService.uploadAttachment(
      req.projectId, taskId, req.user.id, req.file
    );

    return res.status(201).json({
      success: true,
      data: attachment,
      message: 'Upload tài liệu thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId
 * Chỉ người upload hoặc PM mới được xoá.
 */
export const remove = async (req, res, next) => {
  try {
    const { taskId, attachmentId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }
    if (!UUID_REGEX.test(attachmentId)) {
      return badRequest(res, 'attachmentId không hợp lệ');
    }

    await TaskAttachmentService.deleteAttachment(
      req.projectId, taskId, attachmentId, req.user.id, req.projectRole
    );

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Đã xoá tài liệu đính kèm'
    });
  } catch (err) {
    return next(err);
  }
};
