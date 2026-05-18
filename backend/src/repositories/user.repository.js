import { pool } from '../config/db.js';

/**
 * Tìm user theo email (dùng cho đăng nhập).
 * Trả về toàn bộ trường bao gồm password_hash.
 */
export const findByEmail = async (email) => {
  const { rows } = await pool.query(
    'SELECT id, email, password_hash, full_name, system_role, status, created_at, updated_at FROM public.users WHERE email = $1',
    [email]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo ID.
 * Không trả về password_hash.
 */
export const findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, system_role, status, created_at, updated_at FROM public.users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

/**
 * Lấy danh sách toàn bộ nhân sự.
 * Không trả về password_hash.
 */
export const findAll = async () => {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, system_role, status, created_at, updated_at FROM public.users ORDER BY created_at DESC'
  );
  return rows;
};

/**
 * Thêm mới nhân sự.
 */
export const create = async ({ email, passwordHash, fullName, systemRole }) => {
  const { rows } = await pool.query(
    `INSERT INTO public.users (email, password_hash, full_name, system_role, status)
     VALUES ($1, $2, $3, $4, 'Active')
     RETURNING id, email, full_name, system_role, status, created_at`,
    [email, passwordHash, fullName, systemRole]
  );
  return rows[0];
};

/**
 * Cập nhật thông tin nhân sự (không cập nhật password).
 */
export const update = async (id, { fullName, email, systemRole }) => {
  const { rows } = await pool.query(
    `UPDATE public.users
     SET full_name = $1, email = $2, system_role = $3
     WHERE id = $4
     RETURNING id, email, full_name, system_role, status, created_at, updated_at`,
    [fullName, email, systemRole, id]
  );
  return rows[0] || null;
};

/**
 * Cập nhật trạng thái tài khoản (Active <-> Inactive).
 */
export const updateStatus = async (id, status) => {
  const { rows } = await pool.query(
    `UPDATE public.users SET status = $1 WHERE id = $2
     RETURNING id, email, full_name, system_role, status, updated_at`,
    [status, id]
  );
  return rows[0] || null;
};

/**
 * Tìm user theo ID kèm password_hash (dùng cho việc verify mật khẩu hiện tại
 * khi đổi mật khẩu).
 */
export const findByIdWithPassword = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash, full_name, system_role, status
     FROM public.users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Cập nhật password_hash của user.
 */
export const updatePasswordHash = async (id, passwordHash) => {
  const { rowCount } = await pool.query(
    `UPDATE public.users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, id]
  );
  return rowCount > 0;
};

/**
 * Cập nhật `notifications_seen_at = NOW()` để đánh dấu user đã xem mọi thông báo
 * có trước thời điểm này. Trả về timestamp mới.
 */
export const markAllNotificationsSeen = async (id) => {
  const { rows } = await pool.query(
    `UPDATE public.users SET notifications_seen_at = NOW() WHERE id = $1
     RETURNING notifications_seen_at`,
    [id]
  );
  return rows[0]?.notifications_seen_at ?? null;
};
