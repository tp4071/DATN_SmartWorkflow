import { pool } from '../config/db.js';

export const TASK_RETURN_FIELDS = `
  id, project_id, parent_task_id, title, description, priority,
  estimate_hours, due_date, assignee_id, status, order_index,
  is_ai_generated, created_by, created_at, updated_at
`;

/**
 * Lấy task theo id (scoped theo projectId để tránh truy cập chéo dự án).
 */
export const findByIdInProject = async (taskId, projectId) => {
  const { rows } = await pool.query(
    `SELECT ${TASK_RETURN_FIELDS}
     FROM public.tasks
     WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );
  return rows[0] || null;
};

/**
 * Tìm các task chưa Hoàn thành mà user đang là assignee, trong các project
 * "Đang hoạt động". Dùng cho luồng auto-release khi Admin khóa tài khoản.
 * Trả về cả project_id để service biết PM nào cần thông báo.
 */
export const findOpenAssignmentsByUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.project_id, t.title, t.status, p.pm_id, p.name AS project_name
       FROM public.tasks t
       JOIN public.projects p ON p.id = t.project_id
      WHERE t.assignee_id = $1
        AND t.status IN ('Cần làm','Đang làm','Chờ đánh giá')
        AND p.status = 'Đang hoạt động'
      ORDER BY p.id, t.created_at ASC`,
    [userId]
  );
  return rows;
};

/**
 * Atomic clear: gỡ assignee khỏi MỌI task chưa Hoàn thành thuộc các project
 * "Đang hoạt động" mà user đang phụ trách. Trả về list rows đã update để service
 * insert activity_logs cho từng task.
 */
export const clearOpenAssignmentsByUser = async (userId) => {
  const { rows } = await pool.query(
    `UPDATE public.tasks
        SET assignee_id = NULL
      WHERE assignee_id = $1
        AND status IN ('Cần làm','Đang làm','Chờ đánh giá')
        AND project_id IN (SELECT id FROM public.projects WHERE status = 'Đang hoạt động')
      RETURNING id, project_id, title, status`,
    [userId]
  );
  return rows;
};

/**
 * Lấy order_index lớn nhất trong 1 cột (status) của project.
 * Dùng để gán order_index mới khi tạo task thủ công.
 */
export const findMaxOrderIndex = async (projectId, status) => {
  const { rows } = await pool.query(
    `SELECT MAX(order_index) AS max_order
     FROM public.tasks
     WHERE project_id = $1 AND status = $2`,
    [projectId, status]
  );
  const maxOrder = rows[0] && rows[0].max_order;
  return maxOrder === null || maxOrder === undefined ? null : Number(maxOrder);
};

/**
 * Cập nhật các trường thông tin cơ bản của task (không đụng status, order_index).
 * Scope theo project_id để an toàn.
 * @param {import('pg').PoolClient|import('pg').Pool} executor - client (transaction) hoặc pool.
 */
export const updateDetails = async (executor, taskId, projectId, {
  title,
  description,
  priority,
  estimateHours,
  dueDate,
  assigneeId
}) => {
  const runner = executor || pool;
  const { rows } = await runner.query(
    `UPDATE public.tasks
        SET title = $1,
            description = $2,
            priority = $3,
            estimate_hours = $4,
            due_date = $5,
            assignee_id = $6
      WHERE id = $7 AND project_id = $8
     RETURNING ${TASK_RETURN_FIELDS}`,
    [title, description, priority, estimateHours, dueDate, assigneeId, taskId, projectId]
  );
  return rows[0] || null;
};

/**
 * Lấy connection mới từ pool (dùng cho transaction đa bước).
 */
export const getClient = async () => pool.connect();

/**
 * (Trong transaction) Lock task theo id + project_id.
 */
export const lockById = async (client, taskId, projectId) => {
  const { rows } = await client.query(
    `SELECT ${TASK_RETURN_FIELDS}
       FROM public.tasks
      WHERE id = $1 AND project_id = $2
      FOR UPDATE`,
    [taskId, projectId]
  );
  return rows[0] || null;
};

/**
 * (Trong transaction) Lấy danh sách task trong cột, sort theo order_index ASC.
 * excludeTaskId (tuỳ chọn): bỏ 1 task khỏi kết quả.
 */
export const listColumnOrdered = async (client, projectId, status, excludeTaskId = null) => {
  const params = [projectId, status];
  let excludeClause = '';
  if (excludeTaskId) {
    params.push(excludeTaskId);
    excludeClause = ' AND id != $3';
  }
  const { rows } = await client.query(
    `SELECT id, order_index
       FROM public.tasks
      WHERE project_id = $1 AND status = $2${excludeClause}
      ORDER BY order_index ASC, created_at ASC`,
    params
  );
  return rows;
};

/**
 * (Trong transaction) Cập nhật order_index của 1 task.
 */
export const updateOrderIndex = async (client, taskId, orderIndex) => {
  await client.query(
    `UPDATE public.tasks SET order_index = $1 WHERE id = $2`,
    [orderIndex, taskId]
  );
};

/**
 * (Trong transaction) Cập nhật status và order_index đồng thời, trả về bản ghi mới.
 */
export const updateStatusAndOrder = async (client, taskId, status, orderIndex) => {
  const { rows } = await client.query(
    `UPDATE public.tasks
        SET status = $1, order_index = $2
      WHERE id = $3
     RETURNING ${TASK_RETURN_FIELDS}`,
    [status, orderIndex, taskId]
  );
  return rows[0] || null;
};

/**
 * Tạo task mới.
 * @param {object} payload
 * @param {import('pg').PoolClient} [executor] - client (transaction); mặc định dùng pool.
 */
export const create = async ({
  projectId,
  title,
  description,
  priority,
  estimateHours,
  dueDate,
  assigneeId,
  status,
  orderIndex,
  isAiGenerated,
  createdBy = null
}, executor) => {
  const runner = executor || pool;
  const { rows } = await runner.query(
    `INSERT INTO public.tasks
       (project_id, title, description, priority, estimate_hours,
        due_date, assignee_id, status, order_index, is_ai_generated, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${TASK_RETURN_FIELDS}`,
    [
      projectId,
      title,
      description,
      priority,
      estimateHours,
      dueDate,
      assigneeId,
      status,
      orderIndex,
      isAiGenerated,
      createdBy
    ]
  );
  return rows[0];
};

/**
 * Lấy N task gần nhất của project (order by created_at DESC).
 * Dùng để nạp ngữ cảnh cho AI tránh sinh task trùng lặp.
 */
export const findRecentByProject = async (projectId, limit) => {
  const { rows } = await pool.query(
    `SELECT id, title, status, priority, created_at
       FROM public.tasks
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [projectId, limit]
  );
  return rows;
};

const TASK_LIST_COLUMNS = `
  t.id, t.project_id, t.parent_task_id, t.title, t.description,
  t.priority, t.estimate_hours, t.due_date, t.status, t.order_index,
  t.is_ai_generated, t.created_by, t.created_at, t.updated_at,
  t.assignee_id,
  u.full_name AS assignee_name,
  u.email     AS assignee_email,
  uc.full_name AS creator_name,
  uc.email     AS creator_email
`;

/**
 * Liệt kê task của project cho Kanban board.
 *  - Nếu `statusFilter` được truyền: chỉ lấy đúng status đó.
 *  - Nếu không: ẩn 'Chờ duyệt' khỏi Kanban chính (theo Phase 4 spec).
 * Sort theo (status, order_index ASC) để frontend group cột thuận tiện.
 */
export const findKanbanList = async (projectId, { statusFilter } = {}) => {
  const params = [projectId];
  let extraWhere;

  if (statusFilter) {
    params.push(statusFilter);
    extraWhere = `AND t.status = $${params.length}`;
  } else {
    params.push('Chờ duyệt');
    extraWhere = `AND t.status <> $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT ${TASK_LIST_COLUMNS}
       FROM public.tasks t
       LEFT JOIN public.users u  ON u.id  = t.assignee_id
       LEFT JOIN public.users uc ON uc.id = t.created_by
      WHERE t.project_id = $1
        ${extraWhere}
      ORDER BY t.status ASC, t.order_index ASC, t.created_at ASC
      LIMIT 500`,
    params
  );
  return rows;
};

/**
 * Liệt kê task đề xuất (status = 'Chờ duyệt') của 1 project, kèm thông tin người đề xuất.
 * Dùng `assignee_id` làm proxy "người đề xuất" theo spec — Member khi propose
 * thường tự gán mình vào assignee_id (hoặc để trống).
 */
export const findPendingProposalsByProject = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT ${TASK_LIST_COLUMNS}
       FROM public.tasks t
       LEFT JOIN public.users u  ON u.id  = t.assignee_id
       LEFT JOIN public.users uc ON uc.id = t.created_by
      WHERE t.project_id = $1
        AND t.status = 'Chờ duyệt'
      ORDER BY t.created_at DESC`,
    [projectId]
  );
  return rows;
};

/**
 * Detail 1 task: kèm assignee info + count attachments/comments.
 */
export const findDetailInProject = async (taskId, projectId) => {
  const { rows } = await pool.query(
    `SELECT ${TASK_LIST_COLUMNS},
            (SELECT COUNT(*)::int FROM public.task_attachments WHERE task_id = t.id) AS attachments_count,
            (SELECT COUNT(*)::int FROM public.task_comments    WHERE task_id = t.id) AS comments_count
       FROM public.tasks t
       LEFT JOIN public.users u  ON u.id  = t.assignee_id
       LEFT JOIN public.users uc ON uc.id = t.created_by
      WHERE t.id = $1 AND t.project_id = $2`,
    [taskId, projectId]
  );
  return rows[0] || null;
};

/**
 * UC16 - Tìm kiếm task: JOIN tasks <-> users (assignee) và lọc theo keyword.
 * Khớp khi keyword nằm trong tasks.title HOẶC users.full_name (ILIKE, không phân biệt hoa thường).
 * Đã ESCAPE các ký tự ILIKE đặc biệt (%, _, \) ở tầng service, nên ở đây dùng pattern thẳng.
 */
export const searchByKeyword = async (projectId, ilikePattern, limit = 100) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
            t.priority, t.estimate_hours, t.due_date, t.status, t.order_index,
            t.is_ai_generated, t.created_at, t.updated_at,
            t.assignee_id,
            u.full_name AS assignee_name,
            u.email     AS assignee_email
       FROM public.tasks t
       LEFT JOIN public.users u  ON u.id  = t.assignee_id
       LEFT JOIN public.users uc ON uc.id = t.created_by
      WHERE t.project_id = $1
        AND (t.title ILIKE $2 OR u.full_name ILIKE $2)
      ORDER BY t.created_at DESC
      LIMIT $3`,
    [projectId, ilikePattern, limit]
  );
  return rows;
};

/**
 * Hard delete 1 task (scope theo project_id để tránh xoá nhầm).
 * ON DELETE CASCADE sẽ xoá kèm activity_logs / task_comments / task_attachments.
 * Trả về số dòng bị xoá.
 * @param {import('pg').PoolClient|import('pg').Pool} [executor]
 */
export const hardDelete = async (taskId, projectId, executor) => {
  const runner = executor || pool;
  const { rowCount } = await runner.query(
    `DELETE FROM public.tasks WHERE id = $1 AND project_id = $2`,
    [taskId, projectId]
  );
  return rowCount;
};

/**
 * Liệt kê task được giao cho 1 user xuyên suốt mọi project mà user là thành viên.
 *  - Lọc bỏ status 'Chờ duyệt' (task đề xuất chưa duyệt — không phải việc đang phải làm).
 *  - JOIN với projects để frontend hiển thị tên/mã dự án.
 *  - Hỗ trợ filter status và due (overdue / today / this_week / no_due).
 *  - Sort: HIGH > MEDIUM > LOW; nulls cuối; due_date ASC; created_at DESC.
 */
export const findTasksByAssignee = async (assigneeId, { statusFilter, dueFilter } = {}) => {
  const params = [assigneeId];
  const where = [`t.assignee_id = $1`, `t.status <> 'Chờ duyệt'`];

  if (statusFilter) {
    params.push(statusFilter);
    where.push(`t.status = $${params.length}`);
  }

  // Bộ lọc theo hạn chót: dùng CURRENT_DATE để khớp với DATE column.
  if (dueFilter === 'overdue') {
    where.push(`t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status <> 'Hoàn thành'`);
  } else if (dueFilter === 'today') {
    where.push(`t.due_date = CURRENT_DATE`);
  } else if (dueFilter === 'this_week') {
    where.push(`t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`);
  } else if (dueFilter === 'no_due') {
    where.push(`t.due_date IS NULL`);
  }

  const { rows } = await pool.query(
    `SELECT t.id, t.project_id, t.parent_task_id, t.title, t.description,
            t.priority, t.estimate_hours, t.due_date, t.status, t.order_index,
            t.is_ai_generated, t.created_at, t.updated_at,
            t.assignee_id,
            p.project_code, p.name AS project_name, p.status AS project_status
       FROM public.tasks t
       INNER JOIN public.projects p ON p.id = t.project_id
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC,
        (t.due_date IS NULL) ASC,
        t.due_date ASC,
        t.created_at DESC
      LIMIT 500`,
    params
  );
  return rows;
};

/**
 * Đếm số lượng task của user theo từng status (cross-project).
 * Bỏ qua 'Chờ duyệt'. Trả về object { 'Cần làm': n, 'Đang làm': n, ... }.
 */
export const countTasksByAssigneeGroupedByStatus = async (assigneeId) => {
  const { rows } = await pool.query(
    `SELECT t.status, COUNT(*)::int AS count
       FROM public.tasks t
      WHERE t.assignee_id = $1 AND t.status <> 'Chờ duyệt'
      GROUP BY t.status`,
    [assigneeId]
  );
  const result = {};
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
};

/**
 * (Trong transaction) Lấy max(order_index) của 1 cột status thuộc project.
 * Trả về null nếu cột rỗng.
 */
export const findMaxOrderIndexInTx = async (client, projectId, status) => {
  const { rows } = await client.query(
    `SELECT MAX(order_index) AS max_order
       FROM public.tasks
      WHERE project_id = $1 AND status = $2`,
    [projectId, status]
  );
  const maxOrder = rows[0] && rows[0].max_order;
  return maxOrder === null || maxOrder === undefined ? null : Number(maxOrder);
};
