import { pool } from '../config/db.js';

/**
 * UC15 - Đếm task theo status (phục vụ biểu đồ tròn).
 */
export const countTasksByStatus = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS total
       FROM public.tasks
      WHERE project_id = $1
      GROUP BY status
      ORDER BY status ASC`,
    [projectId]
  );
  return rows;
};

/**
 * UC15 - Khối lượng task đang phụ trách theo từng assignee (phục vụ biểu đồ cột).
 * "Đang phụ trách" = task chưa hoàn thành và không ở trạng thái Chờ duyệt.
 * Bao gồm các task chưa được assign (assignee_id IS NULL) gom dưới nhãn 'Chưa phân công'.
 */
export const countActiveWorkloadByAssignee = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT t.assignee_id,
            COALESCE(u.full_name, 'Chưa phân công') AS assignee_name,
            COUNT(*)::int AS total
       FROM public.tasks t
       LEFT JOIN public.users u ON u.id = t.assignee_id
      WHERE t.project_id = $1
        AND t.status IN ('Cần làm', 'Đang làm', 'Chờ đánh giá')
      GROUP BY t.assignee_id, u.full_name
      ORDER BY total DESC`,
    [projectId]
  );
  return rows;
};

/**
 * UC14 - Task đã hoàn thành trong N ngày qua (dùng updated_at để xác định mốc hoàn thành).
 */
export const findCompletedSince = async (projectId, sinceIso) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.priority, t.estimate_hours,
            t.due_date, t.updated_at,
            t.assignee_id,
            COALESCE(u.full_name, 'Chưa phân công') AS assignee_name
       FROM public.tasks t
       LEFT JOIN public.users u ON u.id = t.assignee_id
      WHERE t.project_id = $1
        AND t.status = 'Hoàn thành'
        AND t.updated_at >= $2
      ORDER BY t.updated_at DESC`,
    [projectId, sinceIso]
  );
  return rows;
};

/**
 * UC14 - Task quá hạn phát sinh trong N ngày qua.
 * Quá hạn = due_date < hôm nay AND status != 'Hoàn thành'.
 * "Phát sinh trong 7 ngày" => updated_at HOẶC created_at >= since.
 */
export const findOverdueRecent = async (projectId, sinceIso) => {
  const { rows } = await pool.query(
    `SELECT t.id, t.title, t.status, t.priority,
            t.due_date, t.created_at, t.updated_at,
            t.assignee_id,
            COALESCE(u.full_name, 'Chưa phân công') AS assignee_name
       FROM public.tasks t
       LEFT JOIN public.users u ON u.id = t.assignee_id
      WHERE t.project_id = $1
        AND t.status <> 'Hoàn thành'
        AND t.due_date IS NOT NULL
        AND t.due_date < CURRENT_DATE
        AND (t.updated_at >= $2 OR t.created_at >= $2)
      ORDER BY t.due_date ASC`,
    [projectId, sinceIso]
  );
  return rows;
};

/**
 * UC14 - Comment phát sinh trong N ngày qua, kèm tiêu đề task + tên tác giả.
 */
export const findCommentsSince = async (projectId, sinceIso) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.task_id, c.content, c.created_at,
            t.title AS task_title,
            COALESCE(u.full_name, 'Hệ thống') AS author_name
       FROM public.task_comments c
       JOIN public.tasks t ON t.id = c.task_id
       LEFT JOIN public.users u ON u.id = c.user_id
      WHERE t.project_id = $1
        AND c.created_at >= $2
      ORDER BY c.created_at DESC`,
    [projectId, sinceIso]
  );
  return rows;
};
