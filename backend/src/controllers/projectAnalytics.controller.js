import * as ProjectStatisticsService from '../services/projectStatistics.service.js';
import * as ProjectAiSummaryService from '../services/projectAiSummary.service.js';

/**
 * GET /api/projects/:projectId/statistics
 * UC15 - 2 tập dữ liệu cho biểu đồ tròn (status) + biểu đồ cột (assignee workload).
 */
export const getStatistics = async (req, res, next) => {
  try {
    const stats = await ProjectStatisticsService.getProjectStatistics(req.projectId);

    return res.status(200).json({
      success: true,
      data: stats,
      message: 'Lấy thống kê dự án thành công'
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/projects/:projectId/ai-summary  (PM)
 * UC14 - Tóm tắt tiến độ 7 ngày bằng AI.
 */
export const aiSummary = async (req, res, next) => {
  try {
    // window_days nhận từ body (số ngày phân tích, mặc định 7).
    const result = await ProjectAiSummaryService.generateProjectSummary(
      req.projectId,
      req.body?.window_days
    );

    if (!result.hasData) {
      return res.status(200).json({
        success: true,
        data: null,
        meta: { window_days: result.windowDays },
        message: `Không đủ dữ liệu để tạo báo cáo trong ${result.windowDays} ngày qua`
      });
    }

    return res.status(200).json({
      success: true,
      data: { summary: result.summary, meta: result.meta },
      message: 'Tạo báo cáo tóm tắt thành công'
    });
  } catch (err) {
    return next(err);
  }
};
