import { pool } from '../config/db.js';

/**
 * Lấy danh sách thành viên của dự án kèm thông tin user.
 */
export const findMembersByProjectId = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT pm.project_id, pm.user_id, pm.project_role,
            u.full_name, u.email, u.status, u.system_role
     FROM public.project_members pm
     INNER JOIN public.users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.project_role ASC, u.full_name ASC`,
    [projectId]
  );
  return rows;
};

/**
 * Tìm nhân sự Active chưa tham gia dự án (có thể thêm vào).
 * keyword (tuỳ chọn): tìm theo full_name hoặc email (ILIKE).
 */
export const findAvailableUsers = async (projectId, keyword) => {
  const params = [projectId];
  let whereKeyword = '';

  if (keyword && keyword.trim()) {
    params.push(`%${keyword.trim()}%`);
    whereKeyword = ` AND (u.full_name ILIKE $2 OR u.email ILIKE $2)`;
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.system_role
     FROM public.users u
     WHERE u.status = 'Active'
       AND NOT EXISTS (
         SELECT 1 FROM public.project_members pm
         WHERE pm.project_id = $1 AND pm.user_id = u.id
       )
       ${whereKeyword}
     ORDER BY u.full_name ASC
     LIMIT 50`,
    params
  );
  return rows;
};

/**
 * Kiểm tra một user đã là thành viên của project chưa.
 */
export const findMember = async (projectId, userId) => {
  const { rows } = await pool.query(
    `SELECT project_id, user_id, project_role
     FROM public.project_members
     WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return rows[0] || null;
};

/**
 * Thêm thành viên mới vào dự án với role mặc định MEMBER.
 */
export const addMember = async (projectId, userId) => {
  const { rows } = await pool.query(
    `INSERT INTO public.project_members (project_id, user_id, project_role)
     VALUES ($1, $2, 'MEMBER')
     RETURNING project_id, user_id, project_role`,
    [projectId, userId]
  );
  return rows[0];
};

/**
 * Transaction: xoá thành viên khỏi project_members và
 * set assignee_id = NULL cho mọi task trong project đang gán cho user đó.
 */
export const removeMemberAndUnassignTasks = async (projectId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deleteResult = await client.query(
      `DELETE FROM public.project_members
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );

    const updateResult = await client.query(
      `UPDATE public.tasks
         SET assignee_id = NULL
       WHERE project_id = $1 AND assignee_id = $2`,
      [projectId, userId]
    );

    await client.query('COMMIT');
    return {
      removed: deleteResult.rowCount,
      tasksUnassigned: updateResult.rowCount
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
