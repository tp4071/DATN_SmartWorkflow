import { pool } from '../config/db.js';

const ATTACHMENT_RETURN_FIELDS = `
  id, task_id, uploaded_by, file_name, file_url, created_at
`;

/**
 * Tạo attachment mới gắn vào task.
 * @param {{taskId: string, uploadedBy: string, fileName: string, fileUrl: string}} payload
 * @param {import('pg').PoolClient|import('pg').Pool} [executor]
 */
export const create = async ({ taskId, uploadedBy, fileName, fileUrl }, executor) => {
  const runner = executor || pool;
  const { rows } = await runner.query(
    `INSERT INTO public.task_attachments (task_id, uploaded_by, file_name, file_url)
     VALUES ($1, $2, $3, $4)
     RETURNING ${ATTACHMENT_RETURN_FIELDS}`,
    [taskId, uploadedBy, fileName, fileUrl]
  );
  return rows[0];
};

/**
 * Liệt kê tất cả attachment của task kèm thông tin người upload (JOIN users).
 */
export const findByTaskIdWithUploader = async (taskId) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.task_id, a.file_name, a.file_url, a.created_at,
            a.uploaded_by,
            u.full_name AS uploader_name,
            u.email     AS uploader_email
       FROM public.task_attachments a
       LEFT JOIN public.users u ON u.id = a.uploaded_by
      WHERE a.task_id = $1
      ORDER BY a.created_at DESC`,
    [taskId]
  );
  return rows;
};

/**
 * Lấy attachment theo id; chỉ trả nếu thuộc đúng taskId truyền vào.
 */
export const findByIdForTask = async (attachmentId, taskId) => {
  const { rows } = await pool.query(
    `SELECT ${ATTACHMENT_RETURN_FIELDS}
       FROM public.task_attachments
      WHERE id = $1 AND task_id = $2`,
    [attachmentId, taskId]
  );
  return rows[0] || null;
};

/**
 * Đếm số attachment của 1 task. Dùng để chặn submit-review khi không có tài liệu.
 * Có thể gọi qua client (transaction) hoặc pool.
 */
export const countByTaskId = async (taskId, executor) => {
  const runner = executor || pool;
  const { rows } = await runner.query(
    `SELECT COUNT(*)::int AS total
       FROM public.task_attachments
      WHERE task_id = $1`,
    [taskId]
  );
  return rows[0] ? rows[0].total : 0;
};

/**
 * Xoá attachment theo id.
 */
export const deleteById = async (attachmentId) => {
  const { rowCount } = await pool.query(
    `DELETE FROM public.task_attachments WHERE id = $1`,
    [attachmentId]
  );
  return rowCount;
};
