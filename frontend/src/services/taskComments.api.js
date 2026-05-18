import { request } from './http'

export async function listComments(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/comments`)
  return res?.data ?? []
}

export async function createComment(projectId, taskId, content, mentionedUserIds = []) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
    method: 'POST',
    body: { content, mentioned_user_ids: mentionedUserIds },
  })
  return res?.data
}

export async function updateComment(projectId, taskId, commentId, content) {
  const res = await request(
    `/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    {
      method: 'PUT',
      body: { content },
    },
  )
  return res?.data
}

export async function deleteComment(projectId, taskId, commentId) {
  await request(
    `/api/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
    { method: 'DELETE' },
  )
  return true
}
