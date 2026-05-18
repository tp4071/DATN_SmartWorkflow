import * as ProjectMemberRepository from '../repositories/projectMember.repository.js';
import * as ProjectRepository from '../repositories/project.repository.js';

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
};

/**
 * Lấy danh sách thành viên của dự án.
 */
export const listMembers = async (projectId) => {
  return await ProjectMemberRepository.findMembersByProjectId(projectId);
};

/**
 * Tìm kiếm nhân sự Active chưa tham gia dự án.
 */
export const searchAvailableUsers = async (projectId, keyword) => {
  return await ProjectMemberRepository.findAvailableUsers(projectId, keyword);
};

/**
 * Thêm thành viên mới với role MEMBER.
 * - User phải tồn tại và Active.
 * - Nếu đã là thành viên -> 400.
 */
export const addMember = async (projectId, userId) => {
  const user = await ProjectRepository.findActiveUserById(userId);
  if (!user) {
    throw createError('Nhân sự không hợp lệ hoặc tài khoản đã bị khóa', 400);
  }

  const existing = await ProjectMemberRepository.findMember(projectId, userId);
  if (existing) {
    throw createError('Nhân sự này đã là thành viên của dự án', 400);
  }

  try {
    return await ProjectMemberRepository.addMember(projectId, userId);
  } catch (dbError) {
    // Race condition: unique PK violation
    if (dbError.code === '23505') {
      throw createError('Nhân sự này đã là thành viên của dự án', 400);
    }
    throw dbError;
  }
};

/**
 * Gỡ thành viên và set assignee_id = NULL cho tasks liên quan (transaction).
 * Chặn trường hợp gỡ chính PM hiện tại của dự án.
 */
export const removeMember = async (projectId, userId) => {
  const project = await ProjectRepository.findById(projectId);
  if (!project) {
    throw createError('Không tìm thấy dự án', 404);
  }

  if (project.pm_id === userId) {
    throw createError(
      'Không thể gỡ Quản lý dự án hiện tại. Vui lòng đổi PM trước khi gỡ.',
      400
    );
  }

  const existing = await ProjectMemberRepository.findMember(projectId, userId);
  if (!existing) {
    throw createError('Nhân sự không phải thành viên của dự án', 404);
  }

  const result = await ProjectMemberRepository.removeMemberAndUnassignTasks(
    projectId,
    userId
  );
  return result;
};
