import { request } from './http'

/**
 * UC05 (sinh nháp): POST /api/projects/:projectId/tasks/ai-generate
 *   Body: { requirement: string }
 *   Trả về mảng nháp [{ title, description, priority, estimateHours }] — KHÔNG lưu DB.
 *
 * Backend nhúng project context (name/description/dates + 10 task gần nhất) vào prompt
 * để AI sinh task có liên quan tới phạm vi dự án và tránh trùng lặp.
 */
export async function aiGenerateTasks(projectId, requirement) {
  const res = await request(`/api/projects/${projectId}/tasks/ai-generate`, {
    method: 'POST',
    body: { requirement },
  })
  return res?.data ?? []
}

/**
 * UC05 (xác nhận lưu): POST /api/projects/:projectId/tasks/ai-confirm
 *   Body: { tasks: [{ title, description?, priority, estimate_hours? }] }
 *   Backend validate từng item, INSERT trong transaction, trả về tasks đã tạo
 *   (status='Cần làm', is_ai_generated=true).
 */
export async function aiConfirmTasks(projectId, tasks) {
  const payload = tasks.map((t) => ({
    title: t.title,
    description: t.description || null,
    priority: t.priority,
    // backend cũng accept estimate_hours dạng số; null nếu rỗng
    estimate_hours:
      t.estimateHours === '' || t.estimateHours === null || t.estimateHours === undefined
        ? null
        : Number(t.estimateHours),
  }))
  const res = await request(`/api/projects/${projectId}/tasks/ai-confirm`, {
    method: 'POST',
    body: { tasks: payload },
  })
  return res?.data ?? []
}

/**
 * UC14: POST /api/projects/:projectId/ai-summary
 *   Body: { window_days?: number } (mặc định 7, cho phép 1..90)
 *
 * Trả về:
 *   - { data: { summary, meta }, message }  — có báo cáo
 *   - { data: null, message }              — không đủ dữ liệu (kèm meta.window_days)
 */
export async function aiGenerateProjectSummary(projectId, { windowDays } = {}) {
  const body = windowDays ? { window_days: Number(windowDays) } : {}
  const res = await request(`/api/projects/${projectId}/ai-summary`, {
    method: 'POST',
    body,
  })
  return { data: res?.data ?? null, message: res?.message ?? null, meta: res?.meta ?? null }
}
