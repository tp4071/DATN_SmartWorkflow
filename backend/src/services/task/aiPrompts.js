const DEFAULT_DESCRIPTION = 'Chưa có mô tả';

const formatDate = (value) => {
  if (!value) return 'Chưa xác định';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa xác định';
  return date.toISOString().split('T')[0];
};

export const SYSTEM_PROMPT = `Bạn là một Chuyên gia Quản lý Dự án (Project Manager). Nhiệm vụ của bạn là phân rã yêu cầu của người dùng thành các thẻ công việc (Task) chi tiết.
BẮT BUỘC trả về dữ liệu dưới dạng một mảng JSON thuần túy, tuyệt đối không có markdown, không có text bọc ngoài. Cấu trúc mỗi object:
[{
  "title": "Tên công việc ngắn gọn",
  "description": "Mô tả chi tiết các bước cần làm",
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "estimate_hours": số giờ dự kiến (integer)
}]`;

const NO_TASK_PLACEHOLDER = '(Chưa có công việc nào trong dự án)';

const formatRecentTasks = (recentTasks) => {
  if (!Array.isArray(recentTasks) || recentTasks.length === 0) {
    return NO_TASK_PLACEHOLDER;
  }
  return recentTasks
    .map((task, index) => {
      const title = task.title || '(không tiêu đề)';
      const status = task.status || 'N/A';
      const priority = task.priority || 'N/A';
      return `${index + 1}. ${title} — Trạng thái: ${status} — Ưu tiên: ${priority}`;
    })
    .join('\n');
};

/**
 * Build user prompt nhúng ngữ cảnh dự án + danh sách task hiện có + yêu cầu mới.
 * - Nếu project.description rỗng -> dùng giá trị mặc định "Chưa có mô tả".
 * - Danh sách task gần nhất giúp AI tránh sinh ra task trùng lặp.
 */
export const buildUserPrompt = (project, businessRequirement, recentTasks = []) => {
  const description = project.description && project.description.trim()
    ? project.description.trim()
    : DEFAULT_DESCRIPTION;

  return `--- THÔNG TIN DỰ ÁN HIỆN TẠI ---
Tên dự án: ${project.name}
Mô tả/Mục tiêu dự án: ${description}
Khung thời gian: ${formatDate(project.start_date)} đến ${formatDate(project.end_date)}

--- CÁC CÔNG VIỆC ĐÃ TỒN TẠI TRONG DỰ ÁN ---
${formatRecentTasks(recentTasks)}

--- YÊU CẦU NGHIỆP VỤ MỚI TỪ PM ---
${businessRequirement}

Dựa vào mục tiêu của dự án và các công việc đã có ở trên, hãy phân rã Yêu cầu nghiệp vụ mới thành các Task phù hợp, TRÁNH trùng lặp với các công việc đã tồn tại.`;
};
