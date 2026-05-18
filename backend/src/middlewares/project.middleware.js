import * as ProjectRepository from '../repositories/project.repository.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware kiểm tra quyền truy cập dự án (Project-level Authorization).
 * Phải đặt sau authenticate.
 *
 * - Lấy projectId từ req.params (ưu tiên :projectId, fallback :id).
 * - Lấy userId từ req.user.id.
 * - Truy vấn DB để xác định user có là PM hoặc thành viên không.
 * - Gắn req.projectRole ('MANAGER' | 'MEMBER') và req.projectId cho các handler phía sau.
 * - Nếu không có quyền => 403. Nếu project không tồn tại => 404.
 */
export const requireProjectAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Không tìm thấy thông tin người dùng',
        statusCode: 401
      });
    }

    const projectId = req.params.projectId || req.params.id;

    if (!projectId || !UUID_REGEX.test(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'ID dự án không hợp lệ',
        statusCode: 400
      });
    }

    const { exists, projectRole } = await ProjectRepository.findProjectAccess(
      projectId,
      req.user.id
    );

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy dự án',
        statusCode: 404
      });
    }

    if (!projectRole) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền truy cập dự án này',
        statusCode: 403
      });
    }

    req.projectId = projectId;
    req.projectRole = projectRole;
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Middleware yêu cầu projectRole === 'MANAGER'.
 * Phải đặt sau requireProjectAccess.
 */
export const requireProjectManager = (req, res, next) => {
  if (req.projectRole !== 'MANAGER') {
    return res.status(403).json({
      success: false,
      error: 'Chỉ Quản lý dự án mới được thực hiện thao tác này',
      statusCode: 403
    });
  }
  return next();
};

/**
 * Middleware cho phép ĐỌC trong dự án. Đây là biến thể "lỏng" hơn của
 * requireProjectAccess — cho phép ADMIN xuyên qua kể cả khi không phải thành
 * viên (system_role = 'ADMIN' coi như "viewer" toàn hệ thống). Đặt
 * req.projectRole = 'ADMIN' để các service biết user là khán giả chỉ-xem.
 *
 * KHÔNG dùng cho route ghi: các route ghi vẫn dùng requireProjectAccess
 * (strict) để Admin tự động 403 nếu không phải member của dự án.
 */
export const requireProjectReadAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Không tìm thấy thông tin người dùng',
        statusCode: 401
      });
    }

    const projectId = req.params.projectId || req.params.id;
    if (!projectId || !UUID_REGEX.test(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'ID dự án không hợp lệ',
        statusCode: 400
      });
    }

    // Admin: chỉ cần check project tồn tại, không cần membership.
    if (req.user.system_role === 'ADMIN') {
      const project = await ProjectRepository.findById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Không tìm thấy dự án',
          statusCode: 404
        });
      }
      req.projectId = projectId;
      req.projectRole = 'ADMIN';
      return next();
    }

    // Non-admin: dùng lại logic membership tiêu chuẩn.
    const { exists, projectRole } = await ProjectRepository.findProjectAccess(
      projectId,
      req.user.id
    );
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy dự án',
        statusCode: 404
      });
    }
    if (!projectRole) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền truy cập dự án này',
        statusCode: 403
      });
    }
    req.projectId = projectId;
    req.projectRole = projectRole;
    return next();
  } catch (err) {
    return next(err);
  }
};
