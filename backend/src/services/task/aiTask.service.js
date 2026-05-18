import * as TaskRepository from '../../repositories/task.repository.js';
import * as ProjectRepository from '../../repositories/project.repository.js';
import * as GeminiClient from '../../config/gemini.js';
import { createError } from '../shared/errors.js';
import { DEFAULT_STATUS, DEFAULT_PRIORITY, PRIORITY_VALUES, ORDER_STEP } from './task.constants.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './aiPrompts.js';
import { parseLLMTaskArray } from './aiSanitizer.js';

const MAX_TITLE_LENGTH = 500;
const MAX_GENERATED_TASKS = 50;
const RECENT_TASKS_CONTEXT_LIMIT = 10;

const validateBusinessRequirement = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw createError('requirement là bắt buộc và phải là chuỗi không rỗng', 400);
  }
  return raw.trim();
};

/**
 * Chuẩn hoá 1 object task do AI sinh ra. Bỏ qua các field thừa, ép kiểu an toàn.
 */
const normalizeAiItem = (item, index) => {
  if (!item || typeof item !== 'object') {
    throw createError(`AI trả về phần tử không hợp lệ tại vị trí ${index}`, 400);
  }

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) {
    throw createError(`AI thiếu trường "title" tại vị trí ${index}`, 400);
  }
  const truncatedTitle = title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH)
    : title;

  const description = typeof item.description === 'string' && item.description.trim()
    ? item.description.trim()
    : null;

  const rawPriority = typeof item.priority === 'string' ? item.priority.toUpperCase() : '';
  const priority = PRIORITY_VALUES.includes(rawPriority) ? rawPriority : DEFAULT_PRIORITY;

  let estimateHours = null;
  if (item.estimate_hours !== undefined && item.estimate_hours !== null) {
    const num = Number(item.estimate_hours);
    if (Number.isFinite(num) && num >= 0) {
      estimateHours = Math.round(num);
    }
  }

  return { title: truncatedTitle, description, priority, estimateHours };
};

/**
 * Sinh task NHÁP qua Gemini — KHÔNG ghi vào DB.
 *
 * Theo UC5, PM phải có cơ hội xem/chỉnh sửa/xoá bớt task sai trước khi xác nhận
 * lưu. Vì vậy endpoint /ai-generate chỉ trả mảng nháp; việc lưu chính thức thuộc
 * về /ai-confirm (xem confirmAiTasks bên dưới).
 *
 * Bước 1: Lấy ngữ cảnh project (name, description, start_date, end_date) + 10 task gần nhất.
 * Bước 2: Build system + user prompt theo template.
 * Bước 3: Gọi LLM -> sanitize -> JSON.parse -> normalize -> trả về mảng nháp.
 *
 * @param {string} projectId
 * @param {string} businessRequirement - giá trị req.body.requirement.
 * @returns {Promise<Array<{title, description, priority, estimateHours}>>} mảng task nháp.
 */
export const generateTasks = async (projectId, businessRequirement) => {
  const requirement = validateBusinessRequirement(businessRequirement);

  // Bước 1: lấy ngữ cảnh dự án + 10 task gần nhất (song song để giảm latency).
  const [project, recentTasks] = await Promise.all([
    ProjectRepository.findById(projectId),
    TaskRepository.findRecentByProject(projectId, RECENT_TASKS_CONTEXT_LIMIT)
  ]);
  if (!project) {
    throw createError('Không tìm thấy dự án', 404);
  }

  // Bước 2: build prompts (nhúng cả danh sách task hiện có để AI tránh trùng lặp).
  const userPrompt = buildUserPrompt(project, requirement, recentTasks);

  // Bước 3: gọi LLM -> sanitize -> parse -> normalize.
  const rawText = await GeminiClient.generateContent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt
  });

  const items = parseLLMTaskArray(rawText);
  if (items.length > MAX_GENERATED_TASKS) {
    throw createError(
      `AI sinh quá nhiều công việc (${items.length}). Tối đa cho phép ${MAX_GENERATED_TASKS}.`,
      400
    );
  }

  return items.map(normalizeAiItem);
};

/**
 * Validate 1 item trong payload mà PM gửi lên ở /ai-confirm.
 * Khác `normalizeAiItem` ở chỗ:
 *  - title: strict, rỗng -> 400 (không silent skip).
 *  - priority: strict whitelist; rỗng/sai -> 400.
 *  - estimate_hours: nếu có thì phải >= 0.
 */
const validateConfirmItem = (item, index) => {
  if (!item || typeof item !== 'object') {
    throw createError(`Phần tử thứ ${index + 1} không hợp lệ`, 400);
  }

  const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
  if (!rawTitle) {
    throw createError(`Phần tử thứ ${index + 1}: thiếu title`, 400);
  }
  const title = rawTitle.length > MAX_TITLE_LENGTH
    ? rawTitle.slice(0, MAX_TITLE_LENGTH)
    : rawTitle;

  const rawPriority = typeof item.priority === 'string' ? item.priority.toUpperCase() : '';
  if (!PRIORITY_VALUES.includes(rawPriority)) {
    throw createError(
      `Phần tử thứ ${index + 1}: priority phải là một trong ${PRIORITY_VALUES.join(', ')}`,
      400
    );
  }

  const description = typeof item.description === 'string' && item.description.trim()
    ? item.description.trim()
    : null;

  let estimateHours = null;
  if (item.estimate_hours !== undefined && item.estimate_hours !== null && item.estimate_hours !== '') {
    const num = Number(item.estimate_hours);
    if (!Number.isFinite(num) || num < 0) {
      throw createError(`Phần tử thứ ${index + 1}: estimate_hours phải là số không âm`, 400);
    }
    estimateHours = num;
  }

  return { title, description, priority: rawPriority, estimateHours };
};

/**
 * Lưu mảng task nháp đã được PM duyệt/chỉnh sửa vào DB.
 *
 * - status mặc định 'Cần làm', is_ai_generated = true.
 * - order_index nối tiếp max hiện tại của cột 'Cần làm', mỗi task cách nhau ORDER_STEP.
 * - Toàn bộ thực hiện trong 1 transaction; lỗi 1 task => rollback toàn bộ.
 *
 * @param {string} projectId
 * @param {Array<object>} tasks - mảng task PM gửi lên (có thể đã sửa từ bản nháp AI).
 * @returns {Promise<Array>} danh sách task vừa được tạo.
 */
export const confirmAiTasks = async (projectId, actorUserId, tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw createError('tasks là bắt buộc và phải là mảng không rỗng', 400);
  }
  if (tasks.length > MAX_GENERATED_TASKS) {
    throw createError(
      `Số lượng task vượt quá giới hạn (${tasks.length}/${MAX_GENERATED_TASKS})`,
      400
    );
  }

  const project = await ProjectRepository.findById(projectId);
  if (!project) {
    throw createError('Không tìm thấy dự án', 404);
  }

  const validated = tasks.map(validateConfirmItem);

  const client = await TaskRepository.getClient();
  try {
    await client.query('BEGIN');

    const currentMax = await TaskRepository.findMaxOrderIndexInTx(
      client,
      projectId,
      DEFAULT_STATUS
    );
    let nextOrder = currentMax === null ? ORDER_STEP : currentMax + ORDER_STEP;

    const created = [];
    for (const item of validated) {
      const row = await TaskRepository.create({
        projectId,
        title: item.title,
        description: item.description,
        priority: item.priority,
        estimateHours: item.estimateHours,
        dueDate: null,
        assigneeId: null,
        status: DEFAULT_STATUS,
        orderIndex: nextOrder,
        isAiGenerated: true,
        createdBy: actorUserId
      }, client);
      created.push(row);
      nextOrder += ORDER_STEP;
    }

    await client.query('COMMIT');
    return created;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* already rolled back */ }
    throw err;
  } finally {
    client.release();
  }
};
