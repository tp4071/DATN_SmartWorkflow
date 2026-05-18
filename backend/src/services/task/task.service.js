import * as TaskRepository from '../../repositories/task.repository.js';
import * as ProjectMemberRepository from '../../repositories/projectMember.repository.js';
import * as ActivityLogRepository from '../../repositories/activityLog.repository.js';
import * as TaskAttachmentRepository from '../../repositories/taskAttachment.repository.js';
import * as TaskCommentRepository from '../../repositories/taskComment.repository.js';
import * as Notifications from '../notification.service.js';
import { createError } from '../shared/errors.js';
import { DEFAULT_STATUS, DEFAULT_PRIORITY, ORDER_STEP } from './task.constants.js';
import * as Validators from './task.validators.js';
import * as FractionalIndexing from './fractionalIndexing.js';

const sameDay = (a, b) => {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
};

const SEARCH_KEYWORD_MAX_LENGTH = 200;
const SEARCH_RESULT_LIMIT = 100;

/**
 * Escape các ký tự đặc biệt của ILIKE (%, _, \) trong keyword do user nhập.
 */
const escapeIlikePattern = (raw) => raw.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Validate và chuẩn hoá assignee_id: phải là thành viên project nếu không null.
 */
const ensureAssigneeInProject = async (projectId, assigneeId) => {
  if (!assigneeId) return null;
  const member = await ProjectMemberRepository.findMember(projectId, assigneeId);
  if (!member) {
    throw createError('assignee_id không thuộc dự án này', 400);
  }
  return assigneeId;
};

/**
 * Tạo task thủ công.
 * - order_index = max(order_index) trong cột DEFAULT_STATUS + ORDER_STEP; nếu cột rỗng => ORDER_STEP.
 * - created_by = actorUserId (PM thực hiện thao tác).
 */
export const createTask = async (projectId, actorUserId, {
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

  const maxOrder = await TaskRepository.findMaxOrderIndex(projectId, DEFAULT_STATUS);
  const newOrderIndex = maxOrder === null ? ORDER_STEP : maxOrder + ORDER_STEP;

  return TaskRepository.create({
    projectId,
    title: validatedTitle,
    description: description || null,
    priority: finalPriority,
    estimateHours: parsedEstimate,
    dueDate: parsedDueDate,
    assigneeId: finalAssigneeId,
    status: DEFAULT_STATUS,
    orderIndex: newOrderIndex,
    isAiGenerated: false,
    createdBy: actorUserId
  });
};

/**
 * Cập nhật thông tin chi tiết task (không đổi status, order_index).
 *
 * Phân quyền:
 *  - MANAGER: được sửa mọi task trong project.
 *  - MEMBER: chỉ được sửa task có assignee_id = chính mình (check sau khi đã lock task).
 *
 * Nếu assignee_id thay đổi => insert activity_logs (ASSIGNEE_CHANGED) trong cùng transaction.
 */
export const updateTaskDetails = async (projectId, taskId, actorUserId, projectRole, {
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

  const client = await TaskRepository.getClient();
  try {
    await client.query('BEGIN');

    const existing = await TaskRepository.lockById(client, taskId, projectId);
    if (!existing) {
      await client.query('ROLLBACK');
      throw createError('Không tìm thấy công việc trong dự án này', 404);
    }

    if (projectRole === 'MEMBER' && existing.assignee_id !== actorUserId) {
      await client.query('ROLLBACK');
      throw createError('Bạn không có quyền chỉnh sửa công việc này', 403);
    }

    const updated = await TaskRepository.updateDetails(client, taskId, projectId, {
      title: validatedTitle,
      description: description === undefined ? existing.description : (description || null),
      priority: finalPriority,
      estimateHours: parsedEstimate,
      dueDate: parsedDueDate,
      assigneeId: finalAssigneeId
    });

    if (!updated) {
      await client.query('ROLLBACK');
      throw createError('Không tìm thấy công việc trong dự án này', 404);
    }

    // Ghi log từng loại thay đổi để đẩy thông báo. insertChange trả về row id để
    // gọi dispatchLog sau commit.
    const writtenLogIds = [];

    if (existing.assignee_id !== updated.assignee_id) {
      const log = await ActivityLogRepository.insertChange(client, {
        taskId,
        userId: actorUserId,
        action: ActivityLogRepository.ACTIONS.ASSIGNEE_CHANGED,
        oldValue: existing.assignee_id,
        newValue: updated.assignee_id
      });
      writtenLogIds.push(log.id);
    }
    if (existing.priority !== updated.priority) {
      const log = await ActivityLogRepository.insertChange(client, {
        taskId,
        userId: actorUserId,
        action: ActivityLogRepository.ACTIONS.PRIORITY_CHANGED,
        oldValue: existing.priority,
        newValue: updated.priority
      });
      writtenLogIds.push(log.id);
    }
    if (!sameDay(existing.due_date, updated.due_date)) {
      const log = await ActivityLogRepository.insertChange(client, {
        taskId,
        userId: actorUserId,
        action: ActivityLogRepository.ACTIONS.DUE_DATE_CHANGED,
        oldValue: existing.due_date ? new Date(existing.due_date).toISOString().slice(0, 10) : null,
        newValue: updated.due_date ? new Date(updated.due_date).toISOString().slice(0, 10) : null
      });
      writtenLogIds.push(log.id);
    }

    await client.query('COMMIT');

    // Fire notifications sau commit (fire-and-forget). Mỗi log -> 1 notification event.
    for (const id of writtenLogIds) {
      Notifications.dispatchLog(id);
    }

    return updated;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Di chuyển task theo drag/drop TRONG CÙNG 1 CỘT.
 * - new_status bắt buộc bằng status hiện tại của task.
 * - Áp dụng fractional indexing; nếu khoảng cách quá nhỏ -> rebalance toàn cột.
 * - Tất cả thao tác trong 1 transaction.
 */
export const moveTaskPosition = async (projectId, taskId, {
  newStatus,
  prevOrderIndex,
  nextOrderIndex
}) => {
  const validatedStatus = Validators.validateStatus(newStatus);
  const prev = Validators.parseOrderValue(prevOrderIndex, 'prev_order_index');
  const next = Validators.parseOrderValue(nextOrderIndex, 'next_order_index');

  if (prev !== null && next !== null && next <= prev) {
    throw createError('next_order_index phải lớn hơn prev_order_index', 400);
  }

  const client = await TaskRepository.getClient();
  try {
    await client.query('BEGIN');

    const task = await TaskRepository.lockById(client, taskId, projectId);
    if (!task) {
      await client.query('ROLLBACK');
      throw createError('Không tìm thấy công việc trong dự án này', 404);
    }

    if (validatedStatus !== task.status) {
      await client.query('ROLLBACK');
      throw createError(
        `API này chỉ hỗ trợ kéo thả trong cùng 1 cột. Trạng thái hiện tại là "${task.status}".`,
        400
      );
    }

    let newOrderIndex;

    if (!FractionalIndexing.needsRebalance(prev, next)) {
      newOrderIndex = FractionalIndexing.computeFractionalIndex(prev, next);
    } else {
      const columnRows = await TaskRepository.listColumnOrdered(
        client, projectId, validatedStatus, taskId
      );

      const prevRow = prev === null ? null
        : columnRows.find((r) => Number(r.order_index) === prev);
      const nextRow = next === null ? null
        : columnRows.find((r) => Number(r.order_index) === next);

      const newValueById = await FractionalIndexing.rebalanceColumn(client, columnRows);

      const newPrev = prevRow ? newValueById.get(prevRow.id) : null;
      const newNext = nextRow ? newValueById.get(nextRow.id) : null;

      newOrderIndex = FractionalIndexing.computeFractionalIndex(newPrev, newNext);
    }

    const updated = await TaskRepository.updateStatusAndOrder(
      client, taskId, validatedStatus, newOrderIndex
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
};

const PROPOSED_STATUS = 'Chờ duyệt';

/**
 * Liệt kê task cho Kanban board.
 *  - Không truyền status: trả về toàn bộ tasks NGOẠI TRỪ 'Chờ duyệt' (ẩn khỏi Kanban chính).
 *  - Truyền status: validate trong STATUS_VALUES; nếu là 'Chờ duyệt' thì chỉ PM được xem.
 */
export const listKanbanTasks = async (projectId, projectRole, { status } = {}) => {
  let statusFilter;
  if (status !== undefined && status !== null && status !== '') {
    statusFilter = Validators.validateStatus(status);
    if (statusFilter === PROPOSED_STATUS && projectRole !== 'MANAGER') {
      throw createError('Chỉ PM mới được xem danh sách công việc đề xuất', 403);
    }
  }

  return TaskRepository.findKanbanList(projectId, { statusFilter });
};

/**
 * Lấy detail 1 task trong project, kèm:
 *  - assignee: { id, full_name, email } | null
 *  - attachments[]: { id, file_name, file_url, uploaded_by, uploader_name, ... }
 *  - comments[]: sort created_at ASC, kèm tác giả
 *  - activity_logs[]: sort created_at DESC, kèm actor
 *
 * Sau khi đã đảm bảo task tồn tại, fan-out các truy vấn phụ song song để giảm latency.
 */
export const getTaskDetail = async (projectId, taskId) => {
  const task = await TaskRepository.findDetailInProject(taskId, projectId);
  if (!task) {
    throw createError('Không tìm thấy công việc trong dự án này', 404);
  }

  const [attachments, comments, activityLogs] = await Promise.all([
    TaskAttachmentRepository.findByTaskIdWithUploader(taskId),
    TaskCommentRepository.findByTaskId(taskId),
    ActivityLogRepository.findByTaskId(taskId)
  ]);

  const assignee = task.assignee_id
    ? {
        id: task.assignee_id,
        full_name: task.assignee_name,
        email: task.assignee_email
      }
    : null;

  return {
    ...task,
    assignee,
    attachments,
    comments,
    activity_logs: activityLogs
  };
};

/**
 * UC16 - Tìm kiếm task trong project theo keyword.
 * Match: tasks.title ILIKE keyword HOẶC users.full_name (assignee) ILIKE keyword.
 */
export const searchTasks = async (projectId, rawKeyword) => {
  if (typeof rawKeyword !== 'string' || !rawKeyword.trim()) {
    throw createError('keyword là bắt buộc', 400);
  }
  const keyword = rawKeyword.trim();
  if (keyword.length > SEARCH_KEYWORD_MAX_LENGTH) {
    throw createError(`keyword vượt quá ${SEARCH_KEYWORD_MAX_LENGTH} ký tự`, 400);
  }

  const pattern = `%${escapeIlikePattern(keyword)}%`;
  return TaskRepository.searchByKeyword(projectId, pattern, SEARCH_RESULT_LIMIT);
};
