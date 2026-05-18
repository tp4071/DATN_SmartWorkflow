import { pool } from '../config/db.js';

const COMMENT_RETURN_FIELDS = `
  id, task_id, user_id, content, is_edited, created_at, updated_at
`;

/**
 * Tạo comment mới cho task.
 * Trả về row có kèm full_name của tác giả để frontend render ngay không cần refetch.
 * Hỗ trợ truyền client để chạy trong transaction (vd: ghi reason khi reject-review).
 * @param {{taskId: string, userId: string, content: string, mentionedUserIds?: string[]}} payload
 * @param {import('pg').PoolClient|import('pg').Pool} [executor]
 */
export const create = async ({ taskId, userId, content, mentionedUserIds = [] }, executor) => {
  const runner = executor || pool;
  const { rows } = await runner.query(
    `WITH inserted AS (
       INSERT INTO public.task_comments (task_id, user_id, content, mentioned_user_ids)
       VALUES ($1, $2, $3, $4::uuid[])
       RETURNING id, task_id, user_id, content, is_edited, created_at, updated_at,
                 mentioned_user_ids
     )
     SELECT i.*, u.full_name
       FROM inserted i
       LEFT JOIN public.users u ON u.id = i.user_id`,
    [taskId, userId, content, mentionedUserIds]
  );
  return rows[0];
};

/**
 * Liệt kê comment của task (kèm thông tin tác giả + danh sách user_id được @mention).
 */
export const findByTaskId = async (taskId) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.task_id, c.user_id, c.content, c.is_edited,
            c.created_at, c.updated_at,
            c.mentioned_user_ids,
            u.full_name, u.email AS user_email
       FROM public.task_comments c
       LEFT JOIN public.users u ON u.id = c.user_id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC`,
    [taskId]
  );
  return rows;
};

/**
 * Lấy 1 comment, scope theo taskId để tránh truy cập chéo task.
 */
export const findByIdInTask = async (commentId, taskId) => {
  const { rows } = await pool.query(
    `SELECT ${COMMENT_RETURN_FIELDS}
       FROM public.task_comments
      WHERE id = $1 AND task_id = $2`,
    [commentId, taskId]
  );
  return rows[0] || null;
};

/**
 * Update nội dung comment, tự động bật is_edited = TRUE.
 */
export const updateContent = async (commentId, content) => {
  const { rows } = await pool.query(
    `UPDATE public.task_comments
        SET content = $1, is_edited = TRUE
      WHERE id = $2
     RETURNING ${COMMENT_RETURN_FIELDS}`,
    [content, commentId]
  );
  return rows[0] || null;
};

/**
 * Xoá comment theo id.
 */
export const deleteById = async (commentId) => {
  const { rowCount } = await pool.query(
    `DELETE FROM public.task_comments WHERE id = $1`,
    [commentId]
  );
  return rowCount;
};
