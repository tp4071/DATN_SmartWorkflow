/**
 * Repository hoạt động trên activity_logs:
 *  - Ghi log (gọi trong transaction từ các service khác).
 *  - Đọc log cho task-level và project-level audit feed.
 */
import { pool } from '../config/db.js';

export const ACTIONS = {
  STATUS_CHANGED: 'STATUS_CHANGED',
  ASSIGNEE_CHANGED: 'ASSIGNEE_CHANGED',
  PRIORITY_CHANGED: 'PRIORITY_CHANGED',
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  ATTACHMENT_ADDED: 'ATTACHMENT_ADDED',
  // MENTIONED_IN_COMMENT: ghi 1 log riêng cho MỖI user được @mention.
  // new_value = mentioned user_id (UUID, lưu dạng text). Target notification = chính user đó.
  MENTIONED_IN_COMMENT: 'MENTIONED_IN_COMMENT',
  // ASSIGNEE_UNLINKED_BY_LOCK: assignee bị Admin khóa tài khoản nên hệ thống
  // tự gỡ phụ trách. old_value = userId bị gỡ (UUID dạng text), new_value = null.
  // Target notification = PM dự án (để bổ nhiệm lại).
  ASSIGNEE_UNLINKED_BY_LOCK: 'ASSIGNEE_UNLINKED_BY_LOCK'
};

export const ACTION_VALUES = Object.values(ACTIONS);

/**
 * Các action được coi là "đáng thông báo" — sẽ được trả ra khi gọi
 * GET /api/notifications. Activity log có action ngoài tập này (vd: log nội bộ tương lai)
 * sẽ không hiện ở chuông.
 */
export const NOTIFIABLE_ACTIONS = ACTION_VALUES;

/**
 * Insert 1 bản ghi activity_logs trong transaction.
 * Trả về row vừa insert (để caller có thể emit qua socket).
 * @param {import('pg').PoolClient} client - pg client đã BEGIN.
 */
export const insertChange = async (client, { taskId, userId, action, oldValue, newValue }) => {
  const { rows } = await client.query(
    `INSERT INTO public.activity_logs (task_id, user_id, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, task_id, user_id, action, old_value, new_value, created_at`,
    [taskId, userId, action, oldValue, newValue]
  );
  return rows[0];
};

/**
 * Insert log NGOÀI transaction (dùng cho các service không có sẵn client như
 * comment / attachment).
 */
export const insertChangeStandalone = async ({ taskId, userId, action, oldValue, newValue }) => {
  const { rows } = await pool.query(
    `INSERT INTO public.activity_logs (task_id, user_id, action, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, task_id, user_id, action, old_value, new_value, created_at`,
    [taskId, userId, action, oldValue, newValue]
  );
  return rows[0];
};

/**
 * SELECT chung cho cả task-level và project-level:
 *  - Enrich actor (user thực hiện) -> full_name/email.
 *  - Enrich ASSIGNEE_CHANGED: old/new UUID -> full_name (so sánh ở dạng text để
 *    né lỗi cast khi old_value/new_value không phải UUID hợp lệ ở các action khác).
 */
const LOG_BASE_SELECT = `
  SELECT al.id, al.task_id, al.user_id, al.action,
         al.old_value, al.new_value, al.created_at,
         u_actor.full_name AS actor_name,
         u_actor.email     AS actor_email,
         u_old.full_name   AS old_assignee_name,
         u_new.full_name   AS new_assignee_name,
         t.title           AS task_title
    FROM public.activity_logs al
    JOIN public.tasks t       ON t.id = al.task_id
    LEFT JOIN public.users u_actor ON u_actor.id = al.user_id
    LEFT JOIN public.users u_old
           ON al.action IN ('ASSIGNEE_CHANGED','ASSIGNEE_UNLINKED_BY_LOCK')
          AND u_old.id::text = al.old_value
    LEFT JOIN public.users u_new
           ON al.action = 'ASSIGNEE_CHANGED' AND u_new.id::text = al.new_value
`;

/**
 * Lấy logs của 1 task (sort mới nhất trước). Cap 200 cho an toàn.
 */
export const findByTaskId = async (taskId, limit = 200) => {
  const { rows } = await pool.query(
    `${LOG_BASE_SELECT}
      WHERE al.task_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2`,
    [taskId, limit]
  );
  return rows;
};

/**
 * Lấy logs cấp project, có pagination + filter action.
 *  - actionFilter null|undefined => không lọc.
 *  - Đã JOIN tasks cho cột task_title; FK ON DELETE CASCADE đảm bảo log
 *    không bao giờ trỏ task không tồn tại.
 */
export const findByProjectId = async (projectId, { actionFilter, limit, offset }) => {
  const params = [projectId];
  let actionClause = '';
  if (actionFilter) {
    params.push(actionFilter);
    actionClause = `AND al.action = $${params.length}`;
  }
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const { rows } = await pool.query(
    `${LOG_BASE_SELECT}
      WHERE t.project_id = $1
        ${actionClause}
      ORDER BY al.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows;
};

/**
 * Đếm tổng số log của project (dùng kèm pagination để frontend biết total).
 */
export const countByProjectId = async (projectId, { actionFilter }) => {
  const params = [projectId];
  let actionClause = '';
  if (actionFilter) {
    params.push(actionFilter);
    actionClause = `AND al.action = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM public.activity_logs al
       JOIN public.tasks t ON t.id = al.task_id
      WHERE t.project_id = $1
        ${actionClause}`,
    params
  );
  return rows[0] ? rows[0].total : 0;
};

/* ====== NOTIFICATIONS (read từ activity_logs theo target user) ====== */

/**
 * Một log được coi là "thông báo của user X" nếu:
 *  - Action nằm trong NOTIFIABLE_ACTIONS, VÀ
 *  - Actor (al.user_id) ≠ X (không tự nhận thông báo của chính mình), VÀ
 *  - X là PM của project HOẶC X là assignee_id hiện tại của task
 *    (đây là approximation; nếu task đã đổi assignee sau khi log tạo, logic ưu tiên
 *    user đang giữ task hiện tại — phù hợp UX phổ thông cho hệ thống).
 *
 * is_read = al.created_at <= u.notifications_seen_at (timestamp lần mark-all-read gần nhất).
 */
const NOTIFICATIONS_BASE_FROM = `
  FROM public.activity_logs al
  JOIN public.tasks t        ON t.id = al.task_id
  JOIN public.projects p     ON p.id = t.project_id
  LEFT JOIN public.users u_actor ON u_actor.id = al.user_id
  LEFT JOIN public.users u_old
         ON al.action IN ('ASSIGNEE_CHANGED','ASSIGNEE_UNLINKED_BY_LOCK')
        AND u_old.id::text = al.old_value
  LEFT JOIN public.users u_new
         ON al.action = 'ASSIGNEE_CHANGED' AND u_new.id::text = al.new_value
`;

const NOTIFICATIONS_TARGET_WHERE = `
  WHERE al.action = ANY($2)
    AND (al.user_id IS NULL OR al.user_id <> $1)
    AND (
      (al.action = 'MENTIONED_IN_COMMENT' AND al.new_value = $1::text)
      OR (al.action <> 'MENTIONED_IN_COMMENT' AND (p.pm_id = $1 OR t.assignee_id = $1))
    )
`;

/**
 * Lấy danh sách notification cho user X. Pagination LIMIT/OFFSET.
 */
export const findNotificationsForUser = async (userId, { limit = 50, offset = 0 } = {}) => {
  const params = [userId, NOTIFIABLE_ACTIONS, limit, offset];
  const { rows } = await pool.query(
    `SELECT
        al.id, al.action, al.old_value, al.new_value, al.created_at,
        al.task_id,
        t.title       AS task_title,
        p.id          AS project_id,
        p.name        AS project_name,
        p.project_code,
        u_actor.id    AS actor_id,
        u_actor.full_name AS actor_name,
        u_actor.email     AS actor_email,
        u_old.full_name   AS old_assignee_name,
        u_new.full_name   AS new_assignee_name,
        (al.created_at <= (SELECT notifications_seen_at FROM public.users WHERE id = $1)) AS is_read
       ${NOTIFICATIONS_BASE_FROM}
       ${NOTIFICATIONS_TARGET_WHERE}
     ORDER BY al.created_at DESC
     LIMIT $3 OFFSET $4`,
    params
  );
  return rows;
};

/**
 * Đếm số thông báo CHƯA ĐỌC cho user (created_at > notifications_seen_at).
 */
export const countUnreadForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       ${NOTIFICATIONS_BASE_FROM}
       ${NOTIFICATIONS_TARGET_WHERE}
       AND al.created_at > (SELECT notifications_seen_at FROM public.users WHERE id = $1)`,
    [userId, NOTIFIABLE_ACTIONS]
  );
  return rows[0] ? rows[0].total : 0;
};

/**
 * Enrich 1 log row vừa được insert (cùng shape với findNotificationsForUser)
 * để emit qua socket. Tránh frontend phải refetch.
 *
 * Trả thêm `assignee_id` (cột task hiện tại) cho notification.service pick target.
 */
export const findNotificationById = async (logId) => {
  const { rows } = await pool.query(
    `SELECT
        al.id, al.action, al.old_value, al.new_value, al.created_at,
        al.task_id,
        t.title       AS task_title,
        t.assignee_id AS assignee_id,
        t.created_by  AS task_created_by,
        p.id          AS project_id,
        p.name        AS project_name,
        p.project_code,
        u_actor.id    AS actor_id,
        u_actor.full_name AS actor_name,
        u_actor.email     AS actor_email,
        u_old.full_name   AS old_assignee_name,
        u_new.full_name   AS new_assignee_name
       ${NOTIFICATIONS_BASE_FROM}
       WHERE al.id = $1`,
    [logId]
  );
  return rows[0] || null;
};
