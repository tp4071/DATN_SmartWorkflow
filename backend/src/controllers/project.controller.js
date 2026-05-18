import * as ProjectService from '../services/project.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

/**
 * GET /api/projects?status=<optional>
 * - ADMIN: trả toàn bộ dự án trong hệ thống.
 * - PM/Member: chỉ trả dự án mà user có quyền (qua project_members).
 */
export const list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const projects = await ProjectService.listProjects(req.user, { status });

    return res.status(200).json({
      success: true,
      data: projects,
      message: 'Lấy danh sách dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:id
 * Trả chi tiết dự án + thông tin PM. ADMIN hoặc thành viên dự án mới được xem.
 */
export const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return badRequest(res, 'ID dự án không hợp lệ');
    }

    const project = await ProjectService.getProjectDetail(req.user, id);

    return res.status(200).json({
      success: true,
      data: project,
      message: 'Lấy chi tiết dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects
 * Tạo dự án mới (ADMIN).
 */
export const create = async (req, res, next) => {
  try {
    const { project_code, name, description, start_date, end_date, pm_id } = req.body;

    if (!project_code || !name || !pm_id) {
      return badRequest(res, 'Vui lòng cung cấp đầy đủ: project_code, name, pm_id');
    }

    if (!UUID_REGEX.test(pm_id)) {
      return badRequest(res, 'pm_id không hợp lệ');
    }

    const project = await ProjectService.createProject({
      projectCode: project_code,
      name,
      description,
      startDate: start_date,
      endDate: end_date,
      pmId: pm_id
    });

    return res.status(201).json({
      success: true,
      data: project,
      message: 'Tạo dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:id
 * Cập nhật thông tin dự án + đổi PM (ADMIN).
 */
export const update = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return badRequest(res, 'ID dự án không hợp lệ');
    }

    const { name, description, start_date, end_date, pm_id } = req.body;

    if (!name || !pm_id) {
      return badRequest(res, 'Vui lòng cung cấp đầy đủ: name, pm_id');
    }

    if (!UUID_REGEX.test(pm_id)) {
      return badRequest(res, 'pm_id không hợp lệ');
    }

    const project = await ProjectService.updateProject(id, {
      name,
      description,
      startDate: start_date,
      endDate: end_date,
      pmId: pm_id
    });

    return res.status(200).json({
      success: true,
      data: project,
      message: 'Cập nhật dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/projects/:id/close
 * Đóng dự án (ADMIN).
 */
export const close = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return badRequest(res, 'ID dự án không hợp lệ');
    }

    const project = await ProjectService.closeProject(id);

    return res.status(200).json({
      success: true,
      data: project,
      message: 'Đóng dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};
