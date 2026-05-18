import * as TaskAnalyticsRepository from '../repositories/taskAnalytics.repository.js';
import { STATUS_VALUES } from './task/task.constants.js';

/**
 * UC15 - Thống kê dự án.
 *  - byStatus: số task theo từng status (đảm bảo đủ 5 status, kể cả status có 0 task).
 *  - byAssignee: workload đang phụ trách của từng assignee (sort desc theo total).
 */
export const getProjectStatistics = async (projectId) => {
  const [statusRows, assigneeRows] = await Promise.all([
    TaskAnalyticsRepository.countTasksByStatus(projectId),
    TaskAnalyticsRepository.countActiveWorkloadByAssignee(projectId)
  ]);

  // Đảm bảo trả đủ 5 status với total=0 nếu chưa có task ở cột đó.
  const totalByStatus = new Map(statusRows.map((r) => [r.status, r.total]));
  const byStatus = STATUS_VALUES.map((status) => ({
    status,
    total: totalByStatus.get(status) || 0
  }));

  return { byStatus, byAssignee: assigneeRows };
};
