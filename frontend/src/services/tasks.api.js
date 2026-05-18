import { request } from './http'

/**
 * GET /api/projects/:projectId/tasks?status=
 *  - Mặc định ẩn 'Chờ duyệt' khỏi list trả về (backend xử lý).
 *  - Truyền status='Chờ duyệt' chỉ PM được phép (xem proposals).
 */
export async function listTasks(projectId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : ''
  const res = await request(`/api/projects/${projectId}/tasks${qs}`)
  return res?.data ?? []
}

export async function getTaskDetail(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}`)
  return res?.data
}

/**
 * POST /api/projects/:projectId/tasks  (UC06 — PM tạo thủ công).
 */
export async function createTask(projectId, payload) {
  const res = await request(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: toApiBody(payload),
  })
  return res?.data
}

/**
 * GET /api/projects/:projectId/tasks/search?keyword=  (UC16)
 * Backend khớp keyword với task.title HOẶC users.full_name (assignee), giới hạn 100 row.
 * Có thể trả task ở bất kỳ status nào — frontend tự lọc 'Chờ duyệt' khi hiển thị Kanban.
 */
export async function searchTasks(projectId, keyword) {
  const qs = new URLSearchParams({ keyword: keyword ?? '' }).toString()
  const res = await request(`/api/projects/${projectId}/tasks/search?${qs}`)
  return res?.data ?? []
}

/**
 * PUT /api/projects/:projectId/tasks/:taskId/position  (UC10 — drag & drop)
 *
 * Backend chỉ hỗ trợ kéo thả trong CÙNG 1 cột (status không đổi). Body:
 *   - new_status        = status hiện tại
 *   - prev_order_index  = order_index của thẻ liền kề trước (null nếu kéo lên đầu)
 *   - next_order_index  = order_index của thẻ liền kề sau (null nếu kéo xuống cuối)
 *
 * Backend dùng fractional indexing: order_index mới = trung bình của 2 hàng xóm,
 * tự rebalance nếu khoảng cách quá nhỏ.
 */
export async function moveTaskPosition(projectId, taskId, { newStatus, prevOrderIndex, nextOrderIndex }) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/position`, {
    method: 'PUT',
    body: {
      new_status: newStatus,
      prev_order_index: prevOrderIndex ?? null,
      next_order_index: nextOrderIndex ?? null,
    },
  })
  return res?.data
}

/**
 * PUT /api/projects/:projectId/tasks/:taskId  (UC09 — cập nhật chi tiết).
 *  - MANAGER: sửa mọi task trong project
 *  - MEMBER:  chỉ task có assignee_id = chính mình (backend enforce)
 *  - Không đổi status / order_index ở endpoint này (xem UC10/UC11/UC12).
 */
export async function updateTask(projectId, taskId, payload) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: toApiBody(payload),
  })
  return res?.data
}

/**
 * POST /api/projects/:projectId/tasks/propose  (UC07 — Member đề xuất).
 */
export async function proposeTask(projectId, payload) {
  const res = await request(`/api/projects/${projectId}/tasks/propose`, {
    method: 'POST',
    body: toApiBody(payload),
  })
  return res?.data
}

/**
 * GET /api/projects/:projectId/tasks/pending-proposals  (chỉ PM)
 * Trả về task đang ở 'Chờ duyệt' kèm creator_name / assignee_name.
 */
export async function listPendingProposals(projectId) {
  const res = await request(`/api/projects/${projectId}/tasks/pending-proposals`)
  return res?.data ?? []
}

/**
 * PUT /api/projects/:projectId/tasks/:taskId/approve  (chỉ PM)
 * 'Chờ duyệt' -> 'Cần làm', đẩy cuối cột.
 */
export async function approveProposal(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/approve`, {
    method: 'PUT',
  })
  return res?.data
}

/**
 * DELETE /api/projects/:projectId/tasks/:taskId/reject  (chỉ PM)
 * Hard delete task đề xuất. Backend gửi notification realtime cho người đề xuất.
 */
export async function rejectProposal(projectId, taskId) {
  await request(`/api/projects/${projectId}/tasks/${taskId}/reject`, {
    method: 'DELETE',
  })
  return true
}

/* ====== UC10/11/12 — Workflow transitions ====== */

/** UC10: 'Cần làm' -> 'Đang làm'. PM hoặc assignee. */
export async function startProgressTask(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/start-progress`, {
    method: 'PUT',
  })
  return res?.data
}

/** UC11: Member nộp nghiệm thu. 'Đang làm' -> 'Chờ đánh giá'. Bắt buộc ≥ 1 attachment. */
export async function submitReviewTask(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/submit-review`, {
    method: 'PUT',
  })
  return res?.data
}

/** UC12: PM phê duyệt. 'Chờ đánh giá' -> 'Hoàn thành'. */
export async function acceptReviewTask(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/accept`, {
    method: 'PUT',
  })
  return res?.data
}

/** UC12: PM trả về làm lại. 'Chờ đánh giá' -> 'Đang làm'. Lý do bắt buộc. */
export async function rejectReviewTask(projectId, taskId, reason) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/reject-review`, {
    method: 'PUT',
    body: { reason },
  })
  return res?.data
}

function toApiBody({ title, description, priority, estimateHours, dueDate, assigneeId }) {
  return {
    title,
    description: description || null,
    priority: priority || 'MEDIUM',
    estimate_hours:
      estimateHours === '' || estimateHours === null || estimateHours === undefined
        ? null
        : Number(estimateHours),
    due_date: dueDate || null,
    assignee_id: assigneeId || null,
  }
}
