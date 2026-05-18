import * as UserService from '../services/user.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/users
 * Lấy danh sách toàn bộ nhân sự.
 */
export const getAll = async (req, res, next) => {
  try {
    const users = await UserService.getAllUsers();

    return res.status(200).json({
      success: true,
      data: users,
      message: 'Lấy danh sách nhân sự thành công'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * Thêm mới nhân sự.
 */
export const create = async (req, res, next) => {
  try {
    const { full_name, email, password, system_role } = req.body;

    // Validate input
    if (!full_name || !email || !password || !system_role) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ: full_name, email, password, system_role',
        statusCode: 400
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Định dạng email không hợp lệ',
        statusCode: 400
      });
    }

    // Validate system_role
    if (!['ADMIN', 'USER'].includes(system_role)) {
      return res.status(400).json({
        success: false,
        error: 'system_role phải là ADMIN hoặc USER',
        statusCode: 400
      });
    }

    const newUser = await UserService.createUser({
      fullName: full_name,
      email,
      password,
      systemRole: system_role
    });

    return res.status(201).json({
      success: true,
      data: newUser,
      message: 'Thêm mới nhân sự thành công'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Cập nhật thông tin nhân sự.
 */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID không hợp lệ',
        statusCode: 400
      });
    }

    const { full_name, email, system_role } = req.body;

    if (!full_name || !email || !system_role) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ: full_name, email, system_role',
        statusCode: 400
      });
    }

    const updatedUser = await UserService.updateUser(id, {
      fullName: full_name,
      email,
      systemRole: system_role
    });

    return res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Cập nhật thông tin nhân sự thành công'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/bulk
 * Nhập danh sách nhân sự từ CSV.
 * Body: { users: [{ full_name, email, password, system_role }, ...] }
 */
export const bulkCreate = async (req, res, next) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        error: 'Body phải có trường users là mảng',
        statusCode: 400
      });
    }

    const result = await UserService.bulkCreateUsers(users);

    return res.status(200).json({
      success: true,
      data: result,
      message: `Đã nhập ${result.created.length}/${result.total} nhân sự thành công`
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/status
 * Khóa/Mở khóa tài khoản.
 */
export const toggleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID không hợp lệ',
        statusCode: 400
      });
    }

    const { user: updatedUser, releasedTasks } = await UserService.toggleUserStatus(id);

    const action = updatedUser.status === 'Active' ? 'kích hoạt' : 'khóa';
    const releasedCount = releasedTasks?.length ?? 0;
    const message = releasedCount > 0
      ? `Đã ${action} tài khoản. Đã tự động gỡ phụ trách ${releasedCount} công việc — PM dự án đã được thông báo.`
      : `Đã ${action} tài khoản thành công`;

    return res.status(200).json({
      success: true,
      data: updatedUser,
      details: { releasedTasks: releasedTasks ?? [] },
      message
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/reset-password
 * Admin reset mật khẩu user về chuỗi ngẫu nhiên. Trả về plain text 1 lần
 * trong response (lưu ý log không in ra password).
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'ID không hợp lệ',
        statusCode: 400
      });
    }

    const result = await UserService.resetUserPassword(id, req.user.id);
    return res.status(200).json({
      success: true,
      data: result,
      message: 'Đã đặt lại mật khẩu thành công. Vui lòng chuyển mật khẩu cho người dùng.'
    });
  } catch (err) {
    next(err);
  }
};
