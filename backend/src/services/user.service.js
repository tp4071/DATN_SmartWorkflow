import bcrypt from 'bcrypt';
import crypto from 'crypto';
import * as UserRepository from '../repositories/user.repository.js';
import * as ProjectRepository from '../repositories/project.repository.js';
import * as TaskRepository from '../repositories/task.repository.js';
import * as ActivityLogRepository from '../repositories/activityLog.repository.js';
import * as Notifications from './notification.service.js';

const SALT_ROUNDS = 10;

/**
 * Sinh mật khẩu ngẫu nhiên 12 ký tự:
 *  - Bảo đảm có chữ in HOA, chữ thường, chữ số (đáp ứng kỳ vọng "mạnh").
 *  - Bỏ các ký tự dễ nhầm (0/O, 1/l/I) để Admin đọc cho user qua điện thoại
 *    không bị nhầm.
 *  - Dùng crypto.randomInt (CSPRNG) để tránh dùng Math.random.
 */
const PWD_LENGTH = 12;
const PWD_UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const PWD_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const PWD_DIGITS = '23456789';
const PWD_ALL = PWD_UPPER + PWD_LOWER + PWD_DIGITS;

const pickRandom = (charset) => charset[crypto.randomInt(0, charset.length)];

const generateRandomPassword = () => {
  const out = [
    pickRandom(PWD_UPPER),
    pickRandom(PWD_LOWER),
    pickRandom(PWD_DIGITS),
  ];
  for (let i = out.length; i < PWD_LENGTH; i++) {
    out.push(pickRandom(PWD_ALL));
  }
  // Shuffle Fisher–Yates dùng randomInt
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
};

/**
 * Lấy danh sách toàn bộ nhân sự.
 */
export const getAllUsers = async () => {
  return await UserRepository.findAll();
};

/**
 * Thêm mới nhân sự.
 * Kiểm tra email trùng, mã hóa mật khẩu.
 */
export const createUser = async ({ fullName, email, password, systemRole }) => {
  // Mã hóa mật khẩu
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    // Lưu vào DB (unique constraint trên email sẽ bắt trùng)
    const newUser = await UserRepository.create({
      email,
      passwordHash,
      fullName,
      systemRole
    });

    return newUser;
  } catch (dbError) {
    // PostgreSQL unique violation code = 23505
    if (dbError.code === '23505') {
      const err = new Error('Email này đã được sử dụng trong hệ thống');
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    throw dbError;
  }
};

/**
 * Cập nhật thông tin nhân sự (không cập nhật mật khẩu).
 */
export const updateUser = async (id, { fullName, email, systemRole }) => {
  // Kiểm tra user tồn tại
  const existingUser = await UserRepository.findById(id);

  if (!existingUser) {
    const err = new Error('Không tìm thấy nhân sự');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  try {
    const updatedUser = await UserRepository.update(id, { fullName, email, systemRole });
    return updatedUser;
  } catch (dbError) {
    if (dbError.code === '23505') {
      const err = new Error('Email này đã được sử dụng trong hệ thống');
      err.statusCode = 400;
      err.isOperational = true;
      throw err;
    }
    throw dbError;
  }
};

/**
 * Khóa/Mở khóa tài khoản (toggle Active <-> Inactive).
 *
 * Khi định KHÓA (Active -> Inactive):
 *  1. Nếu user đang là PM của ít nhất 1 dự án "Đang hoạt động" -> từ chối, trả 409
 *     kèm danh sách dự án để Admin bổ nhiệm PM khác trước.
 *  2. Nếu user là member và đang phụ trách task chưa Hoàn thành -> tự động gỡ
 *     assignee_id khỏi các task đó (giữ nguyên status), ghi activity_log
 *     ASSIGNEE_UNLINKED_BY_LOCK cho TỪNG task và emit notification để PM dự án
 *     biết mà phân công lại. Không chặn admin khóa.
 *
 * Trả về { user, releasedTasks } để controller có thể báo cáo summary.
 */
export const toggleUserStatus = async (id) => {
  const user = await UserRepository.findById(id);

  if (!user) {
    const err = new Error('Không tìm thấy nhân sự');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';

  if (newStatus === 'Inactive') {
    const managedProjects = await ProjectRepository.listActiveProjectsManagedBy(id);
    if (managedProjects.length > 0) {
      const err = new Error(
        `Không thể khóa tài khoản vì người dùng đang là Quản lý của ${managedProjects.length} dự án đang hoạt động. Hãy bổ nhiệm Quản lý khác trước.`
      );
      err.statusCode = 409;
      err.isOperational = true;
      err.details = { managedProjects };
      throw err;
    }
  }

  const updatedUser = await UserRepository.updateStatus(id, newStatus);

  // Auto-release assignments khi vừa khóa thành công.
  let releasedTasks = [];
  if (newStatus === 'Inactive') {
    try {
      releasedTasks = await TaskRepository.clearOpenAssignmentsByUser(id);
      for (const t of releasedTasks) {
        try {
          const log = await ActivityLogRepository.insertChangeStandalone({
            taskId: t.id,
            userId: id, // chính user bị khóa = chủ thể của log (actor "system" gián tiếp)
            action: ActivityLogRepository.ACTIONS.ASSIGNEE_UNLINKED_BY_LOCK,
            oldValue: id,
            newValue: null,
          });
          Notifications.dispatchLog(log.id);
        } catch (err) {
          console.error('[toggleUserStatus] release log failed for task', t.id, err.message);
        }
      }
    } catch (err) {
      console.error('[toggleUserStatus] auto-release failed:', err.message);
    }
  }

  return { user: updatedUser, releasedTasks };
};

/**
 * Admin reset mật khẩu user về 1 chuỗi ngẫu nhiên 12 ký tự.
 * Trả về mật khẩu plain text 1 lần (Admin có nhiệm vụ chuyển cho user).
 *
 * Quy tắc:
 *  - Không cho Admin reset chính mình (tránh tự khóa quyền truy cập).
 *  - Áp dụng được cho mọi user khác bất kể status Active/Inactive
 *    (Admin có thể chuẩn bị mật khẩu trước khi mở khóa lại).
 */
export const resetUserPassword = async (targetId, actorId) => {
  if (targetId === actorId) {
    const err = new Error(
      'Không thể reset mật khẩu của chính bạn. Vui lòng dùng chức năng đổi mật khẩu thông thường.'
    );
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const user = await UserRepository.findById(targetId);
  if (!user) {
    const err = new Error('Không tìm thấy nhân sự');
    err.statusCode = 404;
    err.isOperational = true;
    throw err;
  }

  const newPassword = generateRandomPassword();
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserRepository.updatePasswordHash(targetId, newHash);

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name },
    newPassword,
  };
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_SYSTEM_ROLES = ['ADMIN', 'USER'];
const BULK_MAX_ROWS = 500;
const BULK_MIN_PASSWORD_LEN = 6;

/**
 * Validate cấp ứng dụng cho 1 row trước khi cố INSERT.
 * Trả về { ok: true } hoặc { ok: false, error: 'message' }.
 */
const validateBulkRow = (row) => {
  if (!row || typeof row !== 'object') {
    return { ok: false, error: 'Dòng dữ liệu không hợp lệ' };
  }
  if (!row.full_name || !row.full_name.trim()) {
    return { ok: false, error: 'Thiếu họ tên' };
  }
  if (!row.email || !row.email.trim()) {
    return { ok: false, error: 'Thiếu email' };
  }
  if (!EMAIL_REGEX.test(row.email.trim())) {
    return { ok: false, error: 'Email không đúng định dạng' };
  }
  if (!row.password || row.password.length < BULK_MIN_PASSWORD_LEN) {
    return { ok: false, error: `Mật khẩu phải có tối thiểu ${BULK_MIN_PASSWORD_LEN} ký tự` };
  }
  if (!VALID_SYSTEM_ROLES.includes(row.system_role)) {
    return { ok: false, error: 'system_role phải là ADMIN hoặc USER' };
  }
  return { ok: true };
};

/**
 * Bulk import nhân sự từ mảng row.
 * - Validate, hash, INSERT từng row độc lập (không dùng 1 transaction tổng) để báo cáo
 *   chính xác từng dòng nào fail vì lý do gì.
 * - Phát hiện email trùng trong cùng batch trước khi gọi DB để giảm round-trip.
 * - Trả { created: [...], failed: [{ index, email, error }], total }.
 */
export const bulkCreateUsers = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    const err = new Error('Danh sách nhân sự rỗng');
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }
  if (rows.length > BULK_MAX_ROWS) {
    const err = new Error(`Tối đa ${BULK_MAX_ROWS} dòng mỗi lần nhập`);
    err.statusCode = 400;
    err.isOperational = true;
    throw err;
  }

  const created = [];
  const failed = [];
  const seenEmails = new Set();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] ?? {};
    const row = {
      full_name: typeof raw.full_name === 'string' ? raw.full_name.trim() : raw.full_name,
      email:
        typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : raw.email,
      password: raw.password,
      system_role:
        typeof raw.system_role === 'string'
          ? raw.system_role.trim().toUpperCase()
          : raw.system_role,
    };

    const validation = validateBulkRow(row);
    if (!validation.ok) {
      failed.push({ index: i, email: row.email ?? null, error: validation.error });
      continue;
    }

    if (seenEmails.has(row.email)) {
      failed.push({
        index: i,
        email: row.email,
        error: 'Email bị trùng trong file (đã xuất hiện ở dòng trên)',
      });
      continue;
    }
    seenEmails.add(row.email);

    try {
      const passwordHash = await bcrypt.hash(row.password, SALT_ROUNDS);
      const newUser = await UserRepository.create({
        email: row.email,
        passwordHash,
        fullName: row.full_name,
        systemRole: row.system_role,
      });
      created.push(newUser);
    } catch (dbError) {
      if (dbError.code === '23505') {
        failed.push({
          index: i,
          email: row.email,
          error: 'Email này đã tồn tại trong hệ thống',
        });
      } else {
        failed.push({
          index: i,
          email: row.email,
          error: dbError.message || 'Lỗi không xác định khi thêm dòng này',
        });
      }
    }
  }

  return { created, failed, total: rows.length };
};
