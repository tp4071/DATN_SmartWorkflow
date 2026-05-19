import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  requireProjectAccess,
  requireProjectManager,
  requireProjectReadAccess
} from '../middlewares/project.middleware.js';
import * as ProjectController from '../controllers/project.controller.js';
import * as ProjectMemberController from '../controllers/projectMember.controller.js';
import * as TaskController from '../controllers/task.controller.js';
import * as TaskAttachmentController from '../controllers/taskAttachment.controller.js';
import * as TaskCommentController from '../controllers/taskComment.controller.js';
import * as ProjectAnalyticsController from '../controllers/projectAnalytics.controller.js';
import * as ActivityLogController from '../controllers/activityLog.controller.js';
import { handleSingleFile } from '../middlewares/upload.middleware.js';

const router = Router();

// Mọi API dưới đây đều yêu cầu đã xác thực.
router.use(authenticate);

// ====== Đọc danh sách / chi tiết dự án ======
// GET /api/projects?status=<optional>
//  - ADMIN: thấy mọi dự án.
//  - PM/Member: chỉ thấy dự án mình có trong project_members.
router.get('/', ProjectController.list);

// GET /api/projects/:id
//  - Phân quyền (ADMIN hoặc thành viên dự án) xử lý trong service.
router.get('/:id', ProjectController.getById);

// ====== ADMIN: quản lý thông tin dự án ======
// POST /api/projects
router.post('/', requireAdmin, ProjectController.create);

// PUT /api/projects/:id
router.put('/:id', requireAdmin, ProjectController.update);

// PUT /api/projects/:id/close
router.put('/:id/close', requireAdmin, ProjectController.close);

// PUT /api/projects/:id/reopen
router.put('/:id/reopen', requireAdmin, ProjectController.reopen);

// PUT /api/projects/:id/archive
router.put('/:id/archive', requireAdmin, ProjectController.archive);

// ====== PM: quản lý thành viên dự án ======
// GET /api/projects/:projectId/members
//  - Mọi thành viên dự án đều được xem list (read-only).
//  - Chỉ PM được search-available / add / delete (xem các route phía dưới).
router.get(
  '/:projectId/members',
  requireProjectReadAccess,
  ProjectMemberController.list
);

// GET /api/projects/:projectId/users/search?q=
router.get(
  '/:projectId/users/search',
  requireProjectAccess,
  requireProjectManager,
  ProjectMemberController.searchAvailable
);

// POST /api/projects/:projectId/members
router.post(
  '/:projectId/members',
  requireProjectAccess,
  requireProjectManager,
  ProjectMemberController.add
);

// DELETE /api/projects/:projectId/members/:userId
router.delete(
  '/:projectId/members/:userId',
  requireProjectAccess,
  requireProjectManager,
  ProjectMemberController.remove
);

// ====== Task: quản lý công việc (Kanban) ======
// GET /api/projects/:projectId/tasks/search?keyword=...
// PHẢI khai báo trước các route /:taskId/... để tránh "search" bị parse thành taskId.
router.get(
  '/:projectId/tasks/search',
  requireProjectReadAccess,
  TaskController.search
);

// GET /api/projects/:projectId/tasks/pending-proposals  (PM)
// PHẢI khai báo trước /:projectId/tasks/:taskId để "pending-proposals" không bị
// parse nhầm thành taskId.
router.get(
  '/:projectId/tasks/pending-proposals',
  requireProjectAccess,
  requireProjectManager,
  TaskController.listPendingProposals
);

// GET /api/projects/:projectId/tasks?status=<optional>
router.get(
  '/:projectId/tasks',
  requireProjectReadAccess,
  TaskController.list
);

// GET /api/projects/:projectId/tasks/:taskId  (detail)
router.get(
  '/:projectId/tasks/:taskId',
  requireProjectReadAccess,
  TaskController.detail
);

// POST /api/projects/:projectId/tasks
router.post(
  '/:projectId/tasks',
  requireProjectAccess,
  TaskController.create
);

// PUT /api/projects/:projectId/tasks/:taskId
router.put(
  '/:projectId/tasks/:taskId',
  requireProjectAccess,
  TaskController.updateDetails
);

// PUT /api/projects/:projectId/tasks/:taskId/position
router.put(
  '/:projectId/tasks/:taskId/position',
  requireProjectAccess,
  TaskController.movePosition
);

// POST /api/projects/:projectId/tasks/ai-generate
//  - Trả về mảng task NHÁP, không ghi DB. PM xem/sửa rồi gọi /ai-confirm.
router.post(
  '/:projectId/tasks/ai-generate',
  requireProjectAccess,
  TaskController.aiGenerate
);

// POST /api/projects/:projectId/tasks/ai-confirm
//  - Lưu mảng task nháp (đã được PM chỉnh sửa) vào DB trong 1 transaction.
router.post(
  '/:projectId/tasks/ai-confirm',
  requireProjectAccess,
  TaskController.aiConfirm
);

// ====== UC7 & UC8: Đề xuất / Phê duyệt / Từ chối ======
// POST /api/projects/:projectId/tasks/propose  (Member: bất kỳ thành viên project)
router.post(
  '/:projectId/tasks/propose',
  requireProjectAccess,
  TaskController.propose
);

// PUT /api/projects/:projectId/tasks/:taskId/approve  (PM)
router.put(
  '/:projectId/tasks/:taskId/approve',
  requireProjectAccess,
  requireProjectManager,
  TaskController.approve
);

// DELETE /api/projects/:projectId/tasks/:taskId/reject  (PM)
router.delete(
  '/:projectId/tasks/:taskId/reject',
  requireProjectAccess,
  requireProjectManager,
  TaskController.rejectProposal
);

// ====== Task Attachments ======
// GET /api/projects/:projectId/tasks/:taskId/attachments
router.get(
  '/:projectId/tasks/:taskId/attachments',
  requireProjectReadAccess,
  TaskAttachmentController.list
);

// POST /api/projects/:projectId/tasks/:taskId/attachments
router.post(
  '/:projectId/tasks/:taskId/attachments',
  requireProjectAccess,
  TaskAttachmentController.add
);

// POST /api/projects/:projectId/tasks/:taskId/attachments/upload  (multipart)
//   FE gửi file qua form-data field 'file'. Backend upload Supabase + insert row.
router.post(
  '/:projectId/tasks/:taskId/attachments/upload',
  requireProjectAccess,
  handleSingleFile,
  TaskAttachmentController.upload
);

// DELETE /api/projects/:projectId/tasks/:taskId/attachments/:attachmentId
router.delete(
  '/:projectId/tasks/:taskId/attachments/:attachmentId',
  requireProjectAccess,
  TaskAttachmentController.remove
);

// ====== UC11 & UC12: Nghiệm thu ======
// PUT /api/projects/:projectId/tasks/:taskId/start-progress  (UC10)
//   'Cần làm' -> 'Đang làm'. PM hoặc assignee.
router.put(
  '/:projectId/tasks/:taskId/start-progress',
  requireProjectAccess,
  TaskController.startProgress
);

// PUT /api/projects/:projectId/tasks/:taskId/submit-review  (Member)
router.put(
  '/:projectId/tasks/:taskId/submit-review',
  requireProjectAccess,
  TaskController.submitReview
);

// PUT /api/projects/:projectId/tasks/:taskId/accept  (PM)
router.put(
  '/:projectId/tasks/:taskId/accept',
  requireProjectAccess,
  requireProjectManager,
  TaskController.acceptReview
);

// PUT /api/projects/:projectId/tasks/:taskId/reject-review  (PM)
router.put(
  '/:projectId/tasks/:taskId/reject-review',
  requireProjectAccess,
  requireProjectManager,
  TaskController.rejectReview
);

// ====== UC13: Bình luận công việc (CRUD) ======
// GET    /api/projects/:projectId/tasks/:taskId/comments
router.get(
  '/:projectId/tasks/:taskId/comments',
  requireProjectReadAccess,
  TaskCommentController.list
);

// POST   /api/projects/:projectId/tasks/:taskId/comments
router.post(
  '/:projectId/tasks/:taskId/comments',
  requireProjectAccess,
  TaskCommentController.create
);

// PUT    /api/projects/:projectId/tasks/:taskId/comments/:commentId  (chỉ tác giả)
router.put(
  '/:projectId/tasks/:taskId/comments/:commentId',
  requireProjectAccess,
  TaskCommentController.update
);

// DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId  (tác giả hoặc PM)
router.delete(
  '/:projectId/tasks/:taskId/comments/:commentId',
  requireProjectAccess,
  TaskCommentController.remove
);

// ====== Activity logs ======
// GET /api/projects/:projectId/tasks/:taskId/activity-logs
router.get(
  '/:projectId/tasks/:taskId/activity-logs',
  requireProjectReadAccess,
  ActivityLogController.listForTask
);

// GET /api/projects/:projectId/activity-logs?action=&limit=&offset=
router.get(
  '/:projectId/activity-logs',
  requireProjectReadAccess,
  ActivityLogController.listForProject
);

// ====== UC15: Thống kê dự án ======
// GET /api/projects/:projectId/statistics
router.get(
  '/:projectId/statistics',
  requireProjectReadAccess,
  ProjectAnalyticsController.getStatistics
);

// ====== UC14: Tóm tắt tiến độ bằng AI (PM) ======
// POST /api/projects/:projectId/ai-summary
router.post(
  '/:projectId/ai-summary',
  requireProjectAccess,
  requireProjectManager,
  ProjectAnalyticsController.aiSummary
);

export default router;
