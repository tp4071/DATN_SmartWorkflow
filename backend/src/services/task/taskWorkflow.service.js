import * as TaskRepository from '../../repositories/task.repository.js';
import * as ProjectMemberRepository from '../../repositories/projectMember.repository.js';
import * as ActivityLogRepository from '../../repositories/activityLog.repository.js';
import * as TaskAttachmentRepository from '../../repositories/taskAttachment.repository.js';
import * as TaskCommentRepository from '../../repositories/taskComment.repository.js';
import * as Notifications from '../notification.service.js';
import { createError } from '../shared/errors.js';
import { DEFAULT_PRIORITY, ORDER_STEP } from './task.constants.js';
import * as Validators from './task.validators.js';

const STATUS = {
  PROPOSED: 'Chờ duyệt',
  TODO: 'Cần làm',
  IN_PROGRESS: 'Đang làm',
  REVIEW: 'Chờ đánh giá',
  DONE: 'Hoàn thành'
};

const ensureAssigneeInProject = async (projectId, assigneeId) => {
  if (!assigneeId) return null;
  const member = await ProjectMemberRepository.findMember(projectId, assigneeId);
  if (!member) {
    throw createError('assignee_id không thuộc dự án này', 400);
  }
  return assigneeId;
};

const computeAppendOrderIndex = async (client, projectId, status) => {
  const max = await TaskRepository.findMaxOrderIndexInTx(client, projectId, status);
  return max === null ? ORDER_STEP : max + ORDER_STEP;
};

/**
 * Helper: chuyển task từ expectedStatus -> newStatus, đẩy xuống cuối cột mới,
 * ghi activity log STATUS_CHANGED. Tất cả trong 1 transaction.
 *
 * Hooks (chạy CÙNG transaction để đảm bảo atomicity):
 *  - preCheckInTx(client, { task }):  ràng buộc kiểm tra TRƯỚC khi update status.
 *  - extraInTx(client, { task, updated }): hành động phụ SAU khi update + log.
 *
 * Trả về { updated, logId } để caller dispatch notification sau commit.
 */
const transitionStatus = async ({
  projectId,
  taskId,
  expectedStatus,
  newStatus,
  actorUserId,
  preCheckInTx,
  extraInTx
}) => {
  const client = await TaskRepository.getClient();
  try {
    await client.query('BEGIN');

    const task = await TaskRepository.lockById(client, taskId, projectId);
    if (!task) {
      await client.query('ROLLBACK');
      throw createError('Không tìm thấy công việc trong dự án này', 404);
    }
    if (task.status !== expectedStatus) {
      await client.query('ROLLBACK');
      throw createError(
        `Công việc đang ở trạng thái "${task.status}", không thể chuyển sang "${newStatus}"`,
        400
      );
    }

    if (typeof preCheckInTx === 'function') {
      await preCheckInTx(client, { task });
    }

    const newOrderIndex = await computeAppendOrderIndex(client, projectId, newStatus);
    const updated = await TaskRepository.updateStatusAndOrder(
      client, taskId, newStatus, newOrderIndex
    );

    const log = await ActivityLogRepository.insertChange(client, {
      taskId,
      userId: actorUserId,
      action: ActivityLogRepository.ACTIONS.STATUS_CHANGED,
      oldValue: task.status,
      newValue: updated.status
    });

    if (typeof extraInTx === 'function') {
      await extraInTx(client, { task, updated });
    }

    await client.query('COMMIT');
    return { updated, logId: log.id };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * UC7: Member đề xuất công việc. Insert task với status = 'Chờ duyệt'.
 * order_index = max(order_index) trong cột 'Chờ duyệt' của project + ORDER_STEP.
 * created_by = actorUserId (Member đang đề xuất) — dùng cho notification proposalApproved/rejected.
 */
export const proposeTask = async (projectId, actorUserId, {
  title,
  description,
  priority,
  estimateHours,
  dueDate,
  assigneeId
}) => {
  const validatedTitle = Validators.validateTitle(title);
  const finalPriority = Validators.validatePriority(priority, DEFAULT_PRIORITY);
  const parsedDueDate = Validators.parseDateField(dueDate, 'due_date');
  const parsedEstimate = Validators.parseEstimateHours(estimateHours);
  const finalAssigneeId = await ensureAssigneeInProject(projectId, assigneeId || null);

  const maxOrder = await TaskRepository.findMaxOrderIndex(projectId, STATUS.PROPOSED);
  const newOrderIndex = maxOrder === null ? ORDER_STEP : maxOrder + ORDER_STEP;

  return TaskRepository.create({
    projectId,
    title: validatedTitle,
    description: description || null,
    priority: finalPriority,
    estimateHours: parsedEstimate,
    dueDate: parsedDueDate,
    assigneeId: finalAssigneeId,
    status: STATUS.PROPOSED,
    orderIndex: newOrderIndex,
    isAiGenerated: false,
    createdBy: actorUserId
  });
};

export const listPendingProposals = async (projectId) => {
  return TaskRepository.findPendingProposalsByProject(projectId);
};

/**
 * UC8 (approve): PM duyệt task đề xuất.
 */
export const approveTask = async (projectId, taskId, actorUserId) => {
  const { updated, logId } = await transitionStatus({
    projectId,
    taskId,
    expectedStatus: STATUS.PROPOSED,
    newStatus: STATUS.TODO,
    actorUserId
  });
  Notifications.dispatchLog(logId);
  return updated;
};

/**
 * UC8 (reject): PM từ chối task đề xuất. Hard delete -> log cascade theo
 * nên không persist được; chỉ emit ephemeral cho người đề xuất.
 */
export const rejectProposalTask = async (projectId, taskId, actorUserId) => {
  const client = await TaskRepository.getClient();
  try {
    await client.query('BEGIN');

    const task = await TaskRepository.lockById(client, taskId, projectId);
    if (!task) {
      await client.query('ROLLBACK');
      throw createError('Không tìm thấy công việc trong dự án này', 404);
    }
    if (task.status !== STATUS.PROPOSED) {
      await client.query('ROLLBACK');
      throw createError(
        'Chỉ có thể từ chối công việc đang ở trạng thái "Chờ duyệt"',
        400
      );
    }

    await TaskRepository.hardDelete(taskId, projectId, client);
    await client.query('COMMIT');

    // Notify người đã đề xuất task. Sau migration tasks.created_by, đây là nguồn
    // chính xác. Fallback assignee_id cho task cũ (created_by NULL).
    const proposerId = task.created_by ?? task.assignee_id ?? null;
    Notifications.dispatchEphemeral({
      targetUserIds: [proposerId],
      actorId: actorUserId,
      payload: {
        id: `ephemeral-${task.id}-rejected`,
        action: 'PROPOSAL_REJECTED',
        old_value: null,
        new_value: null,
        created_at: new Date().toISOString(),
        task_id: task.id,
        task_title: task.title,
        assignee_id: task.assignee_id,
        task_created_by: task.created_by ?? null,
        project_id: projectId,
        project_name: null,
        project_code: null,
        actor_id: actorUserId,
        actor_name: null,
        is_read: false,
        ephemeral: true,
      },
    });
    return true;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * UC10 (partial): chuyển task từ 'Cần làm' -> 'Đang làm'.
 * Phân quyền: PM (canManage ở route) hoặc assignee_id === actorUserId.
 *  - Member chưa được assign → 403.
 * Gọi qua endpoint riêng vì không phải drag&drop same-column (movePosition).
 */
export const startProgressTask = async (projectId, taskId, actorUserId, projectRole) => {
  const { updated, logId } = await transitionStatus({
    projectId,
    taskId,
    expectedStatus: STATUS.TODO,
    newStatus: STATUS.IN_PROGRESS,
    actorUserId,
    preCheckInTx: async (_client, { task }) => {
      if (projectRole !== 'MANAGER' && task.assignee_id !== actorUserId) {
        throw createError('Chỉ người phụ trách hoặc PM mới có thể bắt đầu công việc này', 403);
      }
    }
  });
  Notifications.dispatchLog(logId);
  return updated;
};

/**
 * UC11: Member nộp công việc nghiệm thu. 'Đang làm' -> 'Chờ đánh giá'.
 */
export const submitReviewTask = async (projectId, taskId, actorUserId) => {
  const { updated, logId } = await transitionStatus({
    projectId,
    taskId,
    expectedStatus: STATUS.IN_PROGRESS,
    newStatus: STATUS.REVIEW,
    actorUserId,
    preCheckInTx: async (client, { task }) => {
      if (task.assignee_id !== actorUserId) {
        throw createError('Bạn không phải người phụ trách công việc này', 403);
      }
      const total = await TaskAttachmentRepository.countByTaskId(task.id, client);
      if (total === 0) {
        throw createError(
          'Vui lòng đính kèm ít nhất 1 tài liệu trước khi nộp nghiệm thu',
          400
        );
      }
    }
  });
  Notifications.dispatchLog(logId);
  return updated;
};

/**
 * UC12 (accept): PM nghiệm thu công việc. 'Chờ đánh giá' -> 'Hoàn thành'.
 */
export const acceptTask = async (projectId, taskId, actorUserId) => {
  const { updated, logId } = await transitionStatus({
    projectId,
    taskId,
    expectedStatus: STATUS.REVIEW,
    newStatus: STATUS.DONE,
    actorUserId
  });
  Notifications.dispatchLog(logId);
  return updated;
};

/**
 * UC12 (reject-review): PM từ chối nghiệm thu, đẩy task quay lại 'Đang làm'
 * và tự động lưu lý do vào task_comments.
 */
export const rejectReviewTask = async (projectId, taskId, actorUserId, reason) => {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw createError('reason là bắt buộc khi từ chối nghiệm thu', 400);
  }
  const trimmedReason = reason.trim();

  const { updated, logId } = await transitionStatus({
    projectId,
    taskId,
    expectedStatus: STATUS.REVIEW,
    newStatus: STATUS.IN_PROGRESS,
    actorUserId,
    extraInTx: async (client, { task }) => {
      await TaskCommentRepository.create(
        { taskId: task.id, userId: actorUserId, content: trimmedReason },
        client
      );
    }
  });
  Notifications.dispatchLog(logId);
  return updated;
};
