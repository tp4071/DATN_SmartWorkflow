import { createError } from '../shared/errors.js';

/**
 * Loại bỏ rào markdown ```json ... ``` hoặc ``` ... ``` mà LLM có thể vô tình kèm theo.
 * Chỉ xử lý phần đầu/đuôi để giữ nguyên nội dung JSON bên trong.
 */
const FENCE_REGEX = /^\s*```(?:json|JSON)?\s*([\s\S]*?)\s*```\s*$/;

export const stripCodeFences = (raw) => {
  if (typeof raw !== 'string') return '';
  const match = raw.match(FENCE_REGEX);
  return match ? match[1].trim() : raw.trim();
};

/**
 * Sanitize + JSON.parse output của LLM.
 * Theo yêu cầu: nếu parse fail -> ném HTTP 400 yêu cầu người dùng thử lại.
 */
export const parseLLMTaskArray = (rawText) => {
  const cleaned = stripCodeFences(rawText);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_err) {
    throw createError(
      'AI trả về dữ liệu không hợp lệ (JSON parse lỗi). Vui lòng thử lại.',
      400
    );
  }

  if (!Array.isArray(parsed)) {
    throw createError(
      'AI phải trả về một mảng JSON các công việc. Vui lòng thử lại.',
      400
    );
  }

  if (parsed.length === 0) {
    throw createError(
      'AI không sinh ra công việc nào. Vui lòng diễn đạt lại yêu cầu rõ hơn.',
      400
    );
  }

  return parsed;
};

/**
 * Sanitize + JSON.parse cho output là OBJECT (không phải mảng).
 * Dùng cho AI summary.
 */
export const parseLLMObject = (rawText) => {
  const cleaned = stripCodeFences(rawText);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_err) {
    throw createError(
      'AI trả về dữ liệu không hợp lệ (JSON parse lỗi). Vui lòng thử lại.',
      400
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw createError('AI phải trả về object JSON. Vui lòng thử lại.', 400);
  }

  return parsed;
};
