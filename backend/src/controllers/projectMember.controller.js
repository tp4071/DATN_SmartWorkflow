import * as ProjectMemberService from '../services/projectMember.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const badRequest = (res, message) => res.status(400).json({
  success: false,
  error: message,
  statusCode: 400
});

/**
 * GET /api/projects/:projectId/members
 */
export const list = async (req, res, next) => {
  try {
    const members = await ProjectMemberService.listMembers(req.projectId);
    return res.status(200).json({
      success: true,
      data: members,
      message: 'Lấy danh sách thành viên thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/projects/:projectId/users/search
 * Query: ?q=keyword
 */
export const searchAvailable = async (req, res, next) => {
  try {
    const keyword = typeof req.query.q === 'string' ? req.query.q : '';
    const users = await ProjectMemberService.searchAvailableUsers(
      req.projectId,
      keyword
    );
    return res.status(200).json({
      success: true,
      data: users,
      message: 'Lấy danh sách nhân sự khả dụng thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/members
 * Body: { user_id }
 */
export const add = async (req, res, next) => {
  try {
    const { user_id } = req.body;

    if (!user_id || !UUID_REGEX.test(user_id)) {
      return badRequest(res, 'user_id không hợp lệ');
    }

    const member = await ProjectMemberService.addMember(req.projectId, user_id);

    return res.status(201).json({
      success: true,
      data: member,
      message: 'Thêm thành viên vào dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/projects/:projectId/members/:userId
 */
export const remove = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!UUID_REGEX.test(userId)) {
      return badRequest(res, 'userId không hợp lệ');
    }

    const result = await ProjectMemberService.removeMember(req.projectId, userId);

    return res.status(200).json({
      success: true,
      data: result,
      message: 'Gỡ thành viên khỏi dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};
