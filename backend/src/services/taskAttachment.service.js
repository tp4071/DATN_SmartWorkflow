import * as TaskRepository from '../repositories/task.repository.js';
import * as TaskAttachmentRepository from '../repositories/taskAttachment.repository.js';
import * as ActivityLogRepository from '../repositories/activityLog.repository.js';
import * as Notifications from './notification.service.js';
import {
  uploadAttachmentFile,
  deleteAttachmentFileByUrl,
} from './storage.service.js';
import { createError } from './shared/errors.js';

const MAX_FILE_URL_LENGTH = 2048;
const MAX_FILE_NAME_LENGTH = 255;

const validateFileUrl = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw createError('file_url là bắt buộc', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_FILE_URL_LENGTH) {
    throw createError(`file_url vượt quá độ dài cho phép (${MAX_FILE_URL_LENGTH})`, 400);
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw createError('file_url phải bắt đầu bằng http:// hoặc https://', 400);
  }
  return trimmed;
};

const validateFileName = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw createError('file_name là bắt buộc', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_FILE_NAME_LENGTH) {
    throw createError(`file_name vượt quá độ dài cho phép (${MAX_FILE_NAME_LENGTH})`, 400);
  }
  return trimmed;
};

const ensureTaskInProject = async (projectId, taskId) => {
  const task = await TaskRepository.findByIdInProject(taskId, projectId);
  if (!task) {
    throw createError('Không tìm thấy công việc trong dự án này', 404);
  }
  return task;
};

/**
 * Liệt kê attachment của task kèm thông tin người upload.
 */
export const listAttachments = async (projectId, taskId) => {
  await ensureTaskInProject(projectId, taskId);
  return TaskAttachmentRepository.findByTaskIdWithUploader(taskId);
};

/**
 * Thêm attachment cho task. Bất cứ thành viên nào của project đều được upload.
 */
export const addAttachment = async (projectId, taskId, uploaderId, fileName, fileUrl) => {
  await ensureTaskInProject(projectId, taskId);
  const validName = validateFileName(fileName);
  const validUrl = validateFileUrl(fileUrl);

  const attachment = await TaskAttachmentRepository.create({
    taskId,
    uploadedBy: uploaderId,
    fileName: validName,
    fileUrl: validUrl
  });

  try {
    const log = await ActivityLogRepository.insertChangeStandalone({
      taskId,
      userId: uploaderId,
      action: ActivityLogRepository.ACTIONS.ATTACHMENT_ADDED,
      oldValue: null,
      newValue: validName, // tên file để hiển thị thẳng trong notification
    });
    Notifications.dispatchLog(log.id);
  } catch (err) {
    console.error('[addAttachment] log/notify failed:', err.message);
  }

  return attachment;
};

/**
 * Upload file lên Supabase Storage + insert row task_attachments + ghi activity log.
 * `file` là object multer ({ buffer, originalname, mimetype, size }).
 * Trả về attachment row.
 */
export const uploadAttachment = async (projectId, taskId, uploaderId, file) => {
  await ensureTaskInProject(projectId, taskId);
  if (!file) {
    throw createError('Không có file để upload', 400);
  }

  const fileName = validateFileName(file.originalname || 'file');

  // 1. Upload lên Supabase
  const { publicUrl } = await uploadAttachmentFile({ projectId, taskId, file });

  // 2. Lưu row DB
  const attachment = await TaskAttachmentRepository.create({
    taskId,
    uploadedBy: uploaderId,
    fileName,
    fileUrl: publicUrl,
  });

  // 3. Ghi activity log + notification (best-effort)
  try {
    const log = await ActivityLogRepository.insertChangeStandalone({
      taskId,
      userId: uploaderId,
      action: ActivityLogRepository.ACTIONS.ATTACHMENT_ADDED,
      oldValue: null,
      newValue: fileName,
    });
    Notifications.dispatchLog(log.id);
  } catch (err) {
    console.error('[uploadAttachment] log/notify failed:', err.message);
  }

  return attachment;
};

/**
 * Xoá attachment.
 * Chỉ người upload hoặc PM (projectRole = 'MANAGER') được xoá.
 * Sau khi xóa row DB, best-effort xóa file khỏi Supabase Storage.
 */
export const deleteAttachment = async (projectId, taskId, attachmentId, requesterId, projectRole) => {
  await ensureTaskInProject(projectId, taskId);

  const attachment = await TaskAttachmentRepository.findByIdForTask(attachmentId, taskId);
  if (!attachment) {
    throw createError('Không tìm thấy tài liệu đính kèm', 404);
  }

  const isUploader = attachment.uploaded_by === requesterId;
  const isManager = projectRole === 'MANAGER';
  if (!isUploader && !isManager) {
    throw createError('Bạn không có quyền xoá tài liệu này', 403);
  }

  await TaskAttachmentRepository.deleteById(attachmentId);
  // Best-effort xóa file storage — không block response nếu lỗi.
  deleteAttachmentFileByUrl(attachment.file_url).catch(() => {});
  return true;
};
