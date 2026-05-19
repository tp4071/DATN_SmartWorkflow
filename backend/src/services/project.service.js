import * as ProjectRepository from '../repositories/project.repository.js';

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};

/**
 * Validate và parse ngày dạng 'YYYY-MM-DD' hoặc ISO string.
 * Trả về Date hợp lệ hoặc throw lỗi 400.
 */
const parseDateField = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(`Trường ${fieldName} không đúng định dạng ngày`, 400);
  }
  return date;
};

/**
 * Tạo dự án mới (ADMIN).
 * - project_code unique (bắt bởi constraint 23505)
 * - end_date >= start_date
 * - pm_id phải là user Active
 * - Tự thêm PM vào project_members với role MANAGER (transaction)
 */
export const createProject = async ({
  projectCode,
  name,
  description,
  startDate,
  endDate,
  pmId
}) => {
  const parsedStart = parseDateField(startDate, 'start_date');
  const parsedEnd = parseDateField(endDate, 'end_date');

  if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
    throw createError('Ngày kết thúc không được diễn ra trước ngày bắt đầu', 400);
  }

  // Validate PM tồn tại và Active
  const pm = await ProjectRepository.findActiveUserById(pmId);
  if (!pm) {
    throw createError('Quản lý dự án (pm_id) không hợp lệ hoặc tài khoản đã bị khóa', 400);
  }

  try {
    const project = await ProjectRepository.createWithManager({
      projectCode,
      name,
      description: description || null,
      startDate: parsedStart,
      endDate: parsedEnd,
      pmId
    });
    return project;
  } catch (dbError) {
    if (dbError.code === '23505') {
      throw createError('Mã dự án đã tồn tại trong hệ thống', 400);
    }
    throw dbError;
  }
};

/**
 * Cập nhật thông tin dự án (ADMIN).
 */
export const updateProject = async (id, {
  name,
  description,
  startDate,
  endDate,
  pmId
}) => {
  const existing = await ProjectRepository.findById(id);
  if (!existing) {
    throw createError('Không tìm thấy dự án', 404);
  }

  const parsedStart = parseDateField(startDate, 'start_date');
  const parsedEnd = parseDateField(endDate, 'end_date');

  if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
    throw createError('Ngày kết thúc không được diễn ra trước ngày bắt đầu', 400);
  }

  const pm = await ProjectRepository.findActiveUserById(pmId);
  if (!pm) {
    throw createError('Quản lý dự án (pm_id) không hợp lệ hoặc tài khoản đã bị khóa', 400);
  }

  const updated = await ProjectRepository.updateWithManager(id, {
    name,
    description: description || null,
    startDate: parsedStart,
    endDate: parsedEnd,
    pmId,
    previousPmId: existing.pm_id
  });

  if (!updated) {
    throw createError('Không tìm thấy dự án', 404);
  }

  return updated;
};

const ALLOWED_STATUSES = ['Đang hoạt động', 'Đóng', 'Lưu trữ'];

/**
 * Liệt kê dự án.
 * - ADMIN: trả toàn bộ dự án.
 * - PM/Member: chỉ trả dự án mà user có trong project_members.
 * Hỗ trợ lọc theo query.status (bỏ qua nếu không hợp lệ).
 */
export const listProjects = async (user, { status } = {}) => {
  const filterStatus = ALLOWED_STATUSES.includes(status) ? status : null;
  if (user.system_role === 'ADMIN') {
    return ProjectRepository.listAllWithPm({ status: filterStatus });
  }
  return ProjectRepository.listForUserWithPm(user.id, { status: filterStatus });
};

/**
 * Lấy chi tiết dự án kèm thông tin PM.
 * - ADMIN: được phép xem mọi dự án (current_user_role = 'ADMIN').
 * - User khác: phải có trong project_members, ngược lại 403.
 * - Project không tồn tại: 404.
 *
 * Trả thêm trường `current_user_role` ('ADMIN' | 'MANAGER' | 'MEMBER') để frontend
 * biết quyền của user hiện tại trong dự án (dùng để hiển thị UI có điều kiện).
 */
export const getProjectDetail = async (user, projectId) => {
  const project = await ProjectRepository.findByIdWithPm(projectId);
  if (!project) {
    throw createError('Không tìm thấy dự án', 404);
  }

  let currentUserRole;
  if (user.system_role === 'ADMIN') {
    currentUserRole = 'ADMIN';
  } else {
    const { projectRole } = await ProjectRepository.findProjectAccess(projectId, user.id);
    if (!projectRole) {
      throw createError('Bạn không có quyền truy cập dự án này', 403);
    }
    currentUserRole = projectRole;
  }

  return { ...project, current_user_role: currentUserRole };
};

/**
 * Đóng dự án (ADMIN) - chuyển status thành 'Đóng'.
 */
export const closeProject = async (id) => {
  const existing = await ProjectRepository.findById(id);
  if (!existing) {
    throw createError('Không tìm thấy dự án', 404);
  }

  if (existing.status === 'Đóng') {
    throw createError('Dự án đã ở trạng thái đóng', 400);
  }

  const updated = await ProjectRepository.updateStatus(id, 'Đóng');
  if (!updated) {
    throw createError('Không tìm thấy dự án', 404);
  }
  return updated;
};

/**
 * Mở lại dự án (ADMIN). Cho phép từ 'Đóng' hoặc 'Lưu trữ' về 'Đang hoạt động'.
 * Chặn nếu đã 'Đang hoạt động' để báo lỗi rõ thay vì âm thầm no-op.
 */
export const reopenProject = async (id) => {
  const existing = await ProjectRepository.findById(id);
  if (!existing) {
    throw createError('Không tìm thấy dự án', 404);
  }

  if (existing.status === 'Đang hoạt động') {
    throw createError('Dự án đang ở trạng thái hoạt động', 400);
  }

  const updated = await ProjectRepository.updateStatus(id, 'Đang hoạt động');
  if (!updated) {
    throw createError('Không tìm thấy dự án', 404);
  }
  return updated;
};

/**
 * Đưa dự án vào lưu trữ (ADMIN). Cho phép từ 'Đang hoạt động' hoặc 'Đóng'.
 */
export const archiveProject = async (id) => {
  const existing = await ProjectRepository.findById(id);
  if (!existing) {
    throw createError('Không tìm thấy dự án', 404);
  }

  if (existing.status === 'Lưu trữ') {
    throw createError('Dự án đã ở trạng thái lưu trữ', 400);
  }

  const updated = await ProjectRepository.updateStatus(id, 'Lưu trữ');
  if (!updated) {
    throw createError('Không tìm thấy dự án', 404);
  }
  return updated;
};
