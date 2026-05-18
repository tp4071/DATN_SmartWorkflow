import { createError } from '../services/shared/errors.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = 30000;

const getModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;
const getTimeout = () => Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

const ensureApiKey = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw createError('Chưa cấu hình GEMINI_API_KEY trên server', 500);
  }
  return apiKey;
};

/**
 * Gọi Gemini generateContent. Trả về plain text candidate đầu tiên.
 * Dùng responseMimeType=application/json để LLM ưu tiên trả về JSON thuần,
 * tuy vậy phía gọi vẫn phải sanitize phòng trường hợp LLM lỡ kèm markdown.
 */
export const generateContent = async ({ systemPrompt, userPrompt }) => {
  const apiKey = ensureApiKey();
  const model = getModel();
  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeout());

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw createError('Gemini API timeout, vui lòng thử lại', 504);
    }
    throw createError('Không thể kết nối đến Gemini API', 502);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('Gemini API error:', response.status, errorText);
    throw createError('Gemini API trả về lỗi, vui lòng thử lại sau', 502);
  }

  const payload = await response.json().catch(() => null);
  const text = payload
    && payload.candidates
    && payload.candidates[0]
    && payload.candidates[0].content
    && payload.candidates[0].content.parts
    && payload.candidates[0].content.parts[0]
    && payload.candidates[0].content.parts[0].text;

  if (!text) {
    throw createError('Gemini API trả về dữ liệu rỗng', 502);
  }

  return text;
};
