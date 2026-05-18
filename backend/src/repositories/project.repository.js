import { pool } from '../config/db.js';

/**
 * Tìm project theo id.
 */
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, project_code, name, description, start_date, end_date,
            status, pm_id, created_at, updated_at
     FROM public.projects WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Lấy chi tiết project kèm thông tin PM (full_name, email).
 * Dùng cho GET /api/projects/:id.
 */
export const findByIdWithPm = async (id) => {
  const { rows } = await pool.query(
    `SELECT p.id, p.project_code, p.name, p.description,
            p.start_date, p.end_date, p.status, p.pm_id,
            p.created_at, p.updated_at,
            u.full_name AS pm_full_name,
            u.email     AS pm_email
       FROM public.projects p
       LEFT JOIN public.users u ON u.id = p.pm_id
      WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Liệt kê toàn bộ project (ADMIN), kèm PM full_name. Hỗ trợ lọc theo status.
 */
export const listAllWithPm = async ({ status } = {}) => {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE p.status = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.project_code, p.name, p.description,
            p.start_date, p.end_date, p.status, p.pm_id,
            p.created_at, p.updated_at,
            u.full_name AS pm_full_name
       FROM public.projects p
       LEFT JOIN public.users u ON u.id = p.pm_id
       ${where}
      ORDER BY p.created_at DESC`,
    params
  );
  return rows;
};

/**
 * Liệt kê các project mà userId có trong project_members. Hỗ trợ lọc theo status.
 * PM cũng nằm trong project_members (auto-insert khi tạo project) nên không cần OR pm_id.
 */
export const listForUserWithPm = async (userId, { status } = {}) => {
  const params = [userId];
  let extra = '';
  if (status) {
    params.push(status);
    extra = `AND p.status = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT p.id, p.project_code, p.name, p.description,
            p.start_date, p.end_date, p.status, p.pm_id,
            p.created_at, p.updated_at,
            u.full_name AS pm_full_name,
            pm.project_role
       FROM public.projects p
       INNER JOIN public.project_members pm
         ON pm.project_id = p.id AND pm.user_id = $1
       LEFT JOIN public.users u ON u.id = p.pm_id
      WHERE 1=1 ${extra}
      ORDER BY p.created_at DESC`,
    params
  );
  return rows;
};

/**
 * Kiểm tra user tồn tại và đang Active (dùng để validate pm_id).
 */
export const findActiveUserById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, full_name, email, status FROM public.users
     WHERE id = $1 AND status = 'Active'`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Liệt kê các dự án (chỉ status 'Đang hoạt động') mà user đang là PM.
 * Dùng để chặn khóa tài khoản khi user còn quản lý dự án.
 */
export const listActiveProjectsManagedBy = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, project_code, name
       FROM public.projects
      WHERE pm_id = $1 AND status = 'Đang hoạt động'
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Tạo project mới + tự động thêm PM vào project_members với role MANAGER.
 * Dùng transaction đảm bảo toàn vẹn dữ liệu.
 */
export const createWithManager = async ({
  projectCode,
  name,
  description,
  startDate,
  endDate,
  pmId
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertProject = await client.query(
      `INSERT INTO public.projects
         (project_code, name, description, start_date, end_date, pm_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Đang hoạt động')
       RETURNING id, project_code, name, description, start_date, end_date,
                 status, pm_id, created_at, updated_at`,
      [projectCode, name, description, startDate, endDate, pmId]
    );

    const project = insertProject.rows[0];

    await client.query(
      `INSERT INTO public.project_members (project_id, user_id, project_role)
       VALUES ($1, $2, 'MANAGER')`,
      [project.id, pmId]
    );

    await client.query('COMMIT');
    return project;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Cập nhật thông tin dự án (bao gồm đổi PM).
 * Dùng transaction: update projects + đảm bảo PM mới có role MANAGER trong project_members.
 */
export const updateWithManager = async (id, {
  name,
  description,
  startDate,
  endDate,
  pmId,
  previousPmId
}) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `UPDATE public.projects
         SET name = $1, description = $2, start_date = $3,
             end_date = $4, pm_id = $5
       WHERE id = $6
       RETURNING id, project_code, name, description, start_date, end_date,
                 status, pm_id, created_at, updated_at`,
      [name, description, startDate, endDate, pmId, id]
    );

    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Nếu PM thay đổi, đảm bảo PM mới có record với role MANAGER.
    if (previousPmId !== pmId) {
      await client.query(
        `INSERT INTO public.project_members (project_id, user_id, project_role)
         VALUES ($1, $2, 'MANAGER')
         ON CONFLICT (project_id, user_id)
         DO UPDATE SET project_role = 'MANAGER'`,
        [id, pmId]
      );
    }

    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Cập nhật status của project.
 */
export const updateStatus = async (id, status) => {
  const { rows } = await pool.query(
    `UPDATE public.projects SET status = $1 WHERE id = $2
     RETURNING id, project_code, name, status, updated_at`,
    [status, id]
  );
  return rows[0] || null;
};

/**
 * Kiểm tra quyền truy cập dự án của user.
 * Trả về { exists, projectRole } với:
 *  - exists: project có tồn tại hay không
 *  - projectRole: 'MANAGER' | 'MEMBER' | null (null nếu không có quyền)
 *
 * Logic:
 *  - Nếu user là pm_id của project => MANAGER
 *  - Nếu user có trong project_members => theo project_role trong bảng đó
 *  - Ngược lại => null
 */
export const findProjectAccess = async (projectId, userId) => {
  const { rows } = await pool.query(
    `SELECT p.id AS project_id, p.pm_id, pm.project_role
     FROM public.projects p
     LEFT JOIN public.project_members pm
       ON pm.project_id = p.id AND pm.user_id = $2
     WHERE p.id = $1`,
    [projectId, userId]
  );

  if (rows.length === 0) {
    return { exists: false, projectRole: null };
  }

  const row = rows[0];

  if (row.pm_id === userId) {
    return { exists: true, projectRole: 'MANAGER' };
  }

  if (row.project_role) {
    return { exists: true, projectRole: row.project_role };
  }

  return { exists: true, projectRole: null };
};
