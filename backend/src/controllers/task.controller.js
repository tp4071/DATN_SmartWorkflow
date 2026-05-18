import * as TaskService from '../services/task/task.service.js';
import * as AiTaskService from '../services/task/aiTask.service.js';
import * as TaskWorkflowService from '../services/task/taskWorkflow.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

/**
 * POST /api/projects/:projectId/tasks
 */
export const create = async (req, res, next) => {
  try {
    const {
      title,
      description,
      priority,
      estimate_hours,
      due_date,
      assignee_id
    } = req.body;

    if (assignee_id && !UUID_REGEX.test(assignee_id)) {
      return badRequest(res, 'assignee_id không hợp lệ');
    }

    const task = await TaskService.createTask(req.projectId, req.user.id, {
      title,
      description,
      priority,
      estimateHours: estimate_hours,
      dueDate: due_date,
      assigneeId: assignee_id
    });

    return res.status(201).json({
      success: true,
      data: task,
      message: 'Tạo công việc thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId
 * Cập nhật thông tin chi tiết task (không đổi status, order_index).
 */
export const updateDetails = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const {
      title,
      description,
      priority,
      estimate_hours,
      due_date,
      assignee_id
    } = req.body;

    if (assignee_id && !UUID_REGEX.test(assignee_id)) {
      return badRequest(res, 'assignee_id không hợp lệ');
    }

    const task = await TaskService.updateTaskDetails(
      req.projectId,
      taskId,
      req.user.id,
      req.projectRole,
      {
        title,
        description,
        priority,
        estimateHours: estimate_hours,
        dueDate: due_date,
        assigneeId: assignee_id
      }
    );

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Cập nhật công việc thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/position
 * Drag & Drop: đổi vị trí (order_index) task TRONG CÙNG 1 cột.
 */
export const movePosition = async (req, res, next) => {
  try {
    const { taskId } = req.params;

    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const { new_status, prev_order_index, next_order_index } = req.body;

    if (!new_status) {
      return badRequest(res, 'new_status là bắt buộc');
    }

    const task = await TaskService.moveTaskPosition(req.projectId, taskId, {
      newStatus: new_status,
      prevOrderIndex: prev_order_index,
      nextOrderIndex: next_order_index
    });

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Cập nhật vị trí công việc thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks?status=<optional>
 * Liệt kê task cho Kanban board (mặc định ẩn 'Chờ duyệt').
 */
export const list = async (req, res, next) => {
  try {
    const { status } = req.query;

    const tasks = await TaskService.listKanbanTasks(
      req.projectId, req.projectRole, { status }
    );

    return res.status(200).json({
      success: true,
      data: tasks,
      message: 'Lấy danh sách công việc thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks/:taskId
 * Detail task + assignee info + counts (attachments/comments).
 */
export const detail = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const task = await TaskService.getTaskDetail(req.projectId, taskId);

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Lấy chi tiết công việc thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks/search?keyword=...
 * UC16 - tìm task theo title hoặc full_name của assignee.
 */
export const search = async (req, res, next) => {
  try {
    const keyword = typeof req.query.keyword === 'string' ? req.query.keyword : '';

    const tasks = await TaskService.searchTasks(req.projectId, keyword);

    return res.status(200).json({
      success: true,
      data: tasks,
      message: `Tìm thấy ${tasks.length} công việc khớp`
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/propose  (Member)
 * Body: { title, description?, priority?, estimate_hours?, due_date?, assignee_id? }
 * Insert task với status 'Chờ duyệt' (ẩn khỏi Kanban chính - filter ở list API).
 */
export const propose = async (req, res, next) => {
  try {
    const {
      title,
      description,
      priority,
      estimate_hours,
      due_date,
      assignee_id
    } = req.body;

    if (assignee_id && !UUID_REGEX.test(assignee_id)) {
      return badRequest(res, 'assignee_id không hợp lệ');
    }

    const task = await TaskWorkflowService.proposeTask(req.projectId, req.user.id, {
      title,
      description,
      priority,
      estimateHours: estimate_hours,
      dueDate: due_date,
      assigneeId: assignee_id
    });

    return res.status(201).json({
      success: true,
      data: task,
      message: 'Đã gửi đề xuất công việc, chờ PM phê duyệt'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/tasks/pending-proposals  (PM)
 * Liệt kê task đang ở 'Chờ duyệt' (kèm thông tin người đề xuất).
 */
export const listPendingProposals = async (req, res, next) => {
  try {
    const tasks = await TaskWorkflowService.listPendingProposals(req.projectId);

    return res.status(200).json({
      success: true,
      data: tasks,
      message: `Có ${tasks.length} đề xuất đang chờ phê duyệt`
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/approve  (PM)
 * 'Chờ duyệt' -> 'Cần làm', đẩy xuống cuối cột.
 */
export const approve = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const task = await TaskWorkflowService.approveTask(req.projectId, taskId, req.user.id);

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Đã phê duyệt công việc'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/tasks/:taskId/reject  (PM)
 * Hard delete task đề xuất (chỉ khi status đang là 'Chờ duyệt').
 */
export const rejectProposal = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    await TaskWorkflowService.rejectProposalTask(req.projectId, taskId, req.user.id);

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Đã từ chối và xoá công việc đề xuất'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/start-progress  (UC10)
 * 'Cần làm' -> 'Đang làm'. PM hoặc assignee_id = req.user.id.
 */
export const startProgress = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const task = await TaskWorkflowService.startProgressTask(
      req.projectId,
      taskId,
      req.user.id,
      req.projectRole
    );

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Đã chuyển công việc sang trạng thái "Đang làm"'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/submit-review  (Member)
 * 'Đang làm' -> 'Chờ đánh giá'. Bắt buộc có ít nhất 1 attachment.
 */
export const submitReview = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const task = await TaskWorkflowService.submitReviewTask(
      req.projectId, taskId, req.user.id
    );

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Đã gửi công việc đi nghiệm thu'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/accept  (PM)
 * 'Chờ đánh giá' -> 'Hoàn thành'.
 */
export const acceptReview = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const task = await TaskWorkflowService.acceptTask(
      req.projectId, taskId, req.user.id
    );

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Đã nghiệm thu công việc'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:projectId/tasks/:taskId/reject-review  (PM)
 * Body: { reason: string }
 * Đẩy task quay lại 'Đang làm' và lưu lý do vào task_comments.
 */
export const rejectReview = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!UUID_REGEX.test(taskId)) {
      return badRequest(res, 'taskId không hợp lệ');
    }

    const { reason } = req.body || {};

    const task = await TaskWorkflowService.rejectReviewTask(
      req.projectId, taskId, req.user.id, reason
    );

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Đã từ chối nghiệm thu, công việc được trả về Đang làm'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/ai-generate
 * Body: { requirement: string }
 * Sinh task NHÁP từ Gemini — KHÔNG ghi vào DB. PM xem/sửa rồi gọi /ai-confirm để lưu.
 */
export const aiGenerate = async (req, res, next) => {
  try {
    const { requirement } = req.body || {};

    const drafts = await AiTaskService.generateTasks(req.projectId, requirement);

    return res.status(200).json({
      success: true,
      data: drafts,
      message: `AI đã đề xuất ${drafts.length} công việc nháp, vui lòng xem lại trước khi lưu`
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/tasks/ai-confirm
 * Body: { tasks: Array<{ title, description?, priority, estimate_hours? }> }
 * Lưu mảng task nháp đã được PM duyệt/chỉnh sửa vào DB (transaction).
 */
export const aiConfirm = async (req, res, next) => {
  try {
    const { tasks } = req.body || {};

    const created = await AiTaskService.confirmAiTasks(req.projectId, req.user.id, tasks);

    return res.status(201).json({
      success: true,
      data: created,
      message: `Đã lưu ${created.length} công việc do AI sinh ra`
    });
  } catch (err) {
    return next(err);
  }
};
