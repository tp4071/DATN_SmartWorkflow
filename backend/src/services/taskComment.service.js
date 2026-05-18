import * as TaskRepository from '../repositories/task.repository.js';
import * as TaskCommentRepository from '../repositories/taskComment.repository.js';
import * as ActivityLogRepository from '../repositories/activityLog.repository.js';
import * as ProjectMemberRepository from '../repositories/projectMember.repository.js';
import * as Notifications from './notification.service.js';
import { createError } from './shared/errors.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_CONTENT_LENGTH = 5000;

const validateContent = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw createError('content là bắt buộc', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    throw createError(`content vượt quá ${MAX_CONTENT_LENGTH} ký tự`, 400);
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

const ensureCommentInTask = async (taskId, commentId) => {
  const comment = await TaskCommentRepository.findByIdInTask(commentId, taskId);
  if (!comment) {
    throw createError('Không tìm thấy bình luận', 404);
  }
  return comment;
};

/**
 * UC13 - List: liệt kê comment của task. Bất kỳ thành viên project đều được xem.
 */
export const listComments = async (projectId, taskId) => {
  await ensureTaskInProject(projectId, taskId);
  return TaskCommentRepository.findByTaskId(taskId);
};

/**
 * Lọc danh sách user_id được @mention:
 *  - bỏ trùng, bỏ chính tác giả
 *  - phải là UUID hợp lệ
 *  - phải là member của project (chống mention cross-project)
 * Trả về mảng UUID đã lọc.
 */
const sanitizeMentionedUserIds = async (projectId, authorId, rawIds) => {
  if (!Array.isArray(rawIds) || rawIds.length === 0) return [];
  const unique = [...new Set(rawIds)]
    .filter((id) => typeof id === 'string' && UUID_REGEX.test(id))
    .filter((id) => id !== authorId);
  if (unique.length === 0) return [];

  const members = await ProjectMemberRepository.findMembersByProjectId(projectId);
  const memberIds = new Set(members.map((m) => m.user_id));
  return unique.filter((id) => memberIds.has(id));
};

/**
 * UC13 - Create: bất kỳ thành viên project đều được tạo comment.
 * Sau khi tạo:
 *  - Ghi 1 activity_log COMMENT_ADDED -> dispatch cho PM + assignee.
 *  - Với MỖI user được @mention (đã validate là member), ghi thêm 1
 *    activity_log MENTIONED_IN_COMMENT (new_value = mentioned_user_id) -> dispatch
 *    cho chính user đó (notification.service xử lý target riêng).
 */
export const createComment = async (projectId, taskId, userId, content, mentionedUserIds = []) => {
  await ensureTaskInProject(projectId, taskId);
  const validContent = validateContent(content);
  const cleanMentions = await sanitizeMentionedUserIds(projectId, userId, mentionedUserIds);

  const comment = await TaskCommentRepository.create({
    taskId,
    userId,
    content: validContent,
    mentionedUserIds: cleanMentions,
  });

  // Persist log COMMENT_ADDED + notify PM/assignee
  try {
    const log = await ActivityLogRepository.insertChangeStandalone({
      taskId,
      userId,
      action: ActivityLogRepository.ACTIONS.COMMENT_ADDED,
      oldValue: null,
      newValue:
        validContent.length > 200 ? validContent.slice(0, 200) + '…' : validContent,
    });
    Notifications.dispatchLog(log.id);
  } catch (err) {
    console.error('[createComment] log/notify failed:', err.message);
  }

  // Persist 1 log MENTIONED_IN_COMMENT per mention + notify riêng user đó
  for (const mentionedId of cleanMentions) {
    try {
      const mentionLog = await ActivityLogRepository.insertChangeStandalone({
        taskId,
        userId,
        action: ActivityLogRepository.ACTIONS.MENTIONED_IN_COMMENT,
        oldValue: null,
        newValue: mentionedId,
      });
      Notifications.dispatchLog(mentionLog.id);
    } catch (err) {
      console.error('[createComment] mention log failed:', err.message);
    }
  }

  return comment;
};

/**
 * UC13 - Update: chỉ tác giả được sửa, hệ thống tự bật is_edited = TRUE.
 */
export const updateComment = async (projectId, taskId, commentId, requesterId, content) => {
  await ensureTaskInProject(projectId, taskId);
  const comment = await ensureCommentInTask(taskId, commentId);

  if (comment.user_id !== requesterId) {
    throw createError('Bạn chỉ được phép sửa bình luận của chính mình', 403);
  }

  const validContent = validateContent(content);
  return TaskCommentRepository.updateContent(commentId, validContent);
};

/**
 * UC13 - Delete: tác giả hoặc PM (projectRole = 'MANAGER') được xoá.
 */
export const deleteComment = async (projectId, taskId, commentId, requesterId, projectRole) => {
  await ensureTaskInProject(projectId, taskId);
  const comment = await ensureCommentInTask(taskId, commentId);

  const isAuthor = comment.user_id === requesterId;
  const isManager = projectRole === 'MANAGER';
  if (!isAuthor && !isManager) {
    throw createError('Bạn không có quyền xoá bình luận này', 403);
  }

  await TaskCommentRepository.deleteById(commentId);
  return true;
};
