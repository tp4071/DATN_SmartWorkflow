import { getIo } from '../lib/realtime.js';
import * as ProjectRepository from '../repositories/project.repository.js';
import * as ActivityLogRepository from '../repositories/activityLog.repository.js';

/**
 * Hệ thống thông báo gồm 2 nguồn payload đều có cùng shape:
 *
 *  1. dispatchLog(logId) — gửi từ một activity_logs row đã có. Sẽ:
 *     - Fetch enriched row qua findNotificationById (lấy task, project, actor).
 *     - Tính danh sách target user (PM + assignee, loại trừ chính actor).
 *     - Emit `notification` event tới room user:<id> + broadcast `task:updated`
 *       cho project room để live-update Kanban.
 *
 *  2. dispatchEphemeral({...}) — chỉ realtime, KHÔNG persist (vd: PROPOSAL_REJECTED,
 *     vì task vừa bị hard delete -> log cascade).
 *
 * Tất cả method bao trong try/catch để KHÔNG ảnh hưởng request gốc nếu lỗi.
 */

const safe = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error('[notification] dispatch error:', err.message);
  }
};

/**
 * Helper nội bộ: emit `notification` cùng shape DB row tới mảng user, loại trừ actor.
 */
function emitToUsers(targetUserIds, actorId, payload) {
  const io = getIo();
  if (!io) return;
  const unique = [...new Set(targetUserIds.filter(Boolean))].filter((uid) => uid !== actorId);
  if (unique.length === 0) return;
  for (const uid of unique) {
    io.to(`user:${uid}`).emit('notification', payload);
  }
}

/**
 * Broadcast event không phải personal — vd "task:updated" cho client đang xem project.
 */
function emitProjectBroadcast(projectId, eventName, payload) {
  const io = getIo();
  if (!io || !projectId) return;
  io.to(`project:${projectId}`).emit(eventName, payload);
}

/**
 * Đẩy notification dựa trên 1 activity_logs row mới được insert.
 * Đây là entry point chính cho 6 action có persist:
 *   STATUS_CHANGED, ASSIGNEE_CHANGED, PRIORITY_CHANGED, DUE_DATE_CHANGED,
 *   COMMENT_ADDED, ATTACHMENT_ADDED.
 */
export const dispatchLog = safe(async (logId) => {
  if (!logId) return;
  const enriched = await ActivityLogRepository.findNotificationById(logId);
  if (!enriched) return;

  const project = await ProjectRepository.findById(enriched.project_id);
  if (!project) return;

  // Target mặc định: PM + assignee hiện tại của task.
  const assigneeId = enriched.assignee_id ?? null;
  const pmId = project.pm_id ?? null;
  const createdBy = enriched.task_created_by ?? null;
  const targets = [pmId, assigneeId];

  // MENTIONED_IN_COMMENT: target DUY NHẤT là user được mention (new_value).
  // Không gửi cho PM/assignee qua kênh này — họ đã nhận COMMENT_ADDED riêng.
  if (enriched.action === 'MENTIONED_IN_COMMENT') {
    emitToUsers([enriched.new_value], enriched.actor_id, enriched);
    return;
  }

  // ASSIGNEE_CHANGED: bổ sung assignee CŨ và MỚI để cả hai phía đều biết.
  if (enriched.action === 'ASSIGNEE_CHANGED') {
    if (enriched.old_value) targets.push(enriched.old_value);
    if (enriched.new_value) targets.push(enriched.new_value);
  }

  // STATUS_CHANGED 'Chờ duyệt' -> 'Cần làm' = phê duyệt đề xuất.
  // Notify thêm người ĐÃ ĐỀ XUẤT (created_by) — đây là yêu cầu chính của UC08.
  if (
    enriched.action === 'STATUS_CHANGED' &&
    enriched.old_value === 'Chờ duyệt' &&
    enriched.new_value === 'Cần làm'
  ) {
    if (createdBy) targets.push(createdBy);
  }

  emitToUsers(targets, enriched.actor_id, enriched);
  emitProjectBroadcast(enriched.project_id, 'task:updated', {
    taskId: enriched.task_id,
    action: enriched.action,
  });
});

/**
 * Emit notification ephemeral (không persist). Dùng cho các case task bị xóa
 * như PROPOSAL_REJECTED — sau khi xóa thì activity_logs cũng bị cascade.
 */
export const dispatchEphemeral = safe(async ({ targetUserIds, actorId, payload }) => {
  emitToUsers(targetUserIds, actorId, payload);
});

/**
 * Broadcast helper export cho các service không cần persist (vd: refresh Kanban).
 */
export const broadcastToProject = (projectId, eventName, payload) => {
  emitProjectBroadcast(projectId, eventName, payload);
};
