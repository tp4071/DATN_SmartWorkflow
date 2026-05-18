import * as SystemAnalyticsRepository from '../repositories/systemAnalytics.repository.js';

/**
 * GET /api/admin/stats/overview
 * Trả users + projects + tasks counters + top workload + top active projects.
 */
export const overview = async (req, res, next) => {
  try {
    const [counters, topWorkload, topProjects] = await Promise.all([
      SystemAnalyticsRepository.getSystemOverview(),
      SystemAnalyticsRepository.getTopWorkloadUsers(8),
      SystemAnalyticsRepository.getTopActiveProjects(5),
    ]);

    return res.status(200).json({
      success: true,
      data: { ...counters, topWorkload, topProjects },
      message: 'Lấy thống kê hệ thống thành công'
    });
  } catch (err) {
    next(err);
  }
};
