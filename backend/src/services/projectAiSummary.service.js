import * as ProjectRepository from '../repositories/project.repository.js';
import * as TaskAnalyticsRepository from '../repositories/taskAnalytics.repository.js';
import * as GeminiClient from '../config/gemini.js';
import { parseLLMObject } from './task/aiSanitizer.js';
import { createError } from './shared/errors.js';

const DEFAULT_WINDOW_DAYS = 7;
const MIN_WINDOW_DAYS = 1;
const MAX_WINDOW_DAYS = 90;

const REQUIRED_SUMMARY_FIELDS = [
  'danh_gia_tong_quan',
  'diem_nghen',
  'du_bao_rui_ro'
];

export const SUMMARY_SYSTEM_PROMPT = `Bạn là một Senior Project Manager dày dạn kinh nghiệm phân tích dự án phần mềm. Nhiệm vụ của bạn là tổng hợp báo cáo tiến độ dự án trong khung thời gian được chỉ định ở User Prompt, dựa HOÀN TOÀN trên dữ liệu thực tế người dùng cung cấp. KHÔNG được bịa thêm dữ liệu ngoài ngữ cảnh.

Đầu vào (User Prompt) sẽ chứa 3 mảng JSON:
- completed_tasks: các công việc đã hoàn thành trong khung thời gian.
- overdue_tasks: các công việc đang quá hạn (due_date < hôm nay) phát sinh hoặc cập nhật trong khung thời gian.
- recent_comments: các bình luận thảo luận phát sinh trong khung thời gian.

BẮT BUỘC trả về JSON THUẦN, không markdown, không text bọc ngoài, đúng cấu trúc:
{
  "danh_gia_tong_quan": "Đoạn văn 2-3 câu nhận xét tổng thể tiến độ dự án trong khung thời gian phân tích.",
  "diem_nghen": "Liệt kê điểm nghẽn chính (tập trung vào task quá hạn, bình luận tiêu cực, blocker). Có thể dùng nhiều câu hoặc gạch đầu dòng trong cùng một string.",
  "du_bao_rui_ro": "Dự báo các rủi ro sắp tới và đề xuất hành động cụ thể cho PM."
}

Phân tích bằng tiếng Việt, ngắn gọn, đi thẳng vào vấn đề.`;

const formatDateOnly = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

/**
 * Rút gọn task/comment xuống các field thực sự cần thiết để giảm token cost
 * và tránh leak dữ liệu nội bộ không cần thiết cho LLM.
 */
const projectMetaForPrompt = (project) => ({
  name: project.name,
  description: project.description || 'Chưa có mô tả',
  start_date: formatDateOnly(project.start_date),
  end_date: formatDateOnly(project.end_date)
});

const compactCompletedTask = (t) => ({
  title: t.title,
  priority: t.priority,
  estimate_hours: t.estimate_hours,
  assignee: t.assignee_name,
  completed_at: formatDateOnly(t.updated_at)
});

const compactOverdueTask = (t) => ({
  title: t.title,
  status: t.status,
  priority: t.priority,
  assignee: t.assignee_name,
  due_date: formatDateOnly(t.due_date)
});

const compactComment = (c) => ({
  task_title: c.task_title,
  author: c.author_name,
  content: c.content,
  created_at: formatDateOnly(c.created_at)
});

const buildSummaryUserPrompt = ({
  project, completed, overdue, comments, sinceIso, windowDays
}) => `--- THÔNG TIN DỰ ÁN ---
${JSON.stringify(projectMetaForPrompt(project), null, 2)}

--- KHUNG THỜI GIAN PHÂN TÍCH ---
Từ ${formatDateOnly(sinceIso)} đến ${formatDateOnly(new Date())} (${windowDays} ngày qua)

--- DỮ LIỆU ${windowDays} NGÀY QUA ---
completed_tasks (${completed.length}): ${JSON.stringify(completed.map(compactCompletedTask), null, 2)}

overdue_tasks (${overdue.length}): ${JSON.stringify(overdue.map(compactOverdueTask), null, 2)}

recent_comments (${comments.length}): ${JSON.stringify(comments.map(compactComment), null, 2)}

Hãy phân tích và trả về báo cáo theo đúng cấu trúc đã quy định ở System Prompt.`;

const ensureSummaryShape = (parsed) => {
  for (const field of REQUIRED_SUMMARY_FIELDS) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim()) {
      throw createError(
        `AI trả về thiếu hoặc rỗng field "${field}". Vui lòng thử lại.`,
        400
      );
    }
  }
  return {
    danh_gia_tong_quan: parsed.danh_gia_tong_quan.trim(),
    diem_nghen: parsed.diem_nghen.trim(),
    du_bao_rui_ro: parsed.du_bao_rui_ro.trim()
  };
};

/**
 * Validate windowDays nhận từ body request.
 * - undefined / null / '' -> dùng mặc định 7
 * - phải là số nguyên trong [1, 90]
 */
const validateWindowDays = (raw) => {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_WINDOW_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw createError('window_days phải là số nguyên', 400);
  }
  if (n < MIN_WINDOW_DAYS || n > MAX_WINDOW_DAYS) {
    throw createError(
      `window_days phải nằm trong khoảng ${MIN_WINDOW_DAYS}..${MAX_WINDOW_DAYS} ngày`,
      400
    );
  }
  return n;
};

/**
 * UC14 - Tạo báo cáo tóm tắt N ngày bằng AI cho PM.
 *
 * @param {string} projectId
 * @param {number|string} [rawWindowDays] - số ngày phân tích (1..90), mặc định 7.
 *
 * Trả về:
 *   { hasData: false, windowDays }                                    -> không đủ dữ liệu
 *   { hasData: true, summary, meta: { window_days, since, counts } }  -> báo cáo
 */
export const generateProjectSummary = async (projectId, rawWindowDays) => {
  const windowDays = validateWindowDays(rawWindowDays);

  const project = await ProjectRepository.findById(projectId);
  if (!project) {
    throw createError('Không tìm thấy dự án', 404);
  }

  const sinceMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Bước 1: thu thập 3 dataset song song.
  const [completed, overdue, comments] = await Promise.all([
    TaskAnalyticsRepository.findCompletedSince(projectId, sinceIso),
    TaskAnalyticsRepository.findOverdueRecent(projectId, sinceIso),
    TaskAnalyticsRepository.findCommentsSince(projectId, sinceIso)
  ]);

  // Bước 2: kiểm tra dữ liệu rỗng — vẫn trả windowDays để frontend hiển thị đúng.
  if (completed.length === 0 && overdue.length === 0 && comments.length === 0) {
    return { hasData: false, windowDays };
  }

  // Bước 3: build prompt + gọi LLM + parse + validate shape.
  const userPrompt = buildSummaryUserPrompt({
    project, completed, overdue, comments, sinceIso, windowDays
  });

  const rawText = await GeminiClient.generateContent({
    systemPrompt: SUMMARY_SYSTEM_PROMPT,
    userPrompt
  });

  const parsed = parseLLMObject(rawText);
  const summary = ensureSummaryShape(parsed);

  return {
    hasData: true,
    summary,
    meta: {
      window_days: windowDays,
      since: sinceIso,
      counts: {
        completed_tasks: completed.length,
        overdue_tasks: overdue.length,
        recent_comments: comments.length
      }
    }
  };
};
