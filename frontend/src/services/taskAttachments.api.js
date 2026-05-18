import { request } from './http'

export async function listAttachments(projectId, taskId) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/attachments`)
  return res?.data ?? []
}

/**
 * Backend nhận file_name + file_url (URL public bắt đầu http(s)://).
 * Hệ thống chưa có file upload — frontend nhận URL từ user (Supabase Storage,
 * Google Drive share-link, Dropbox, v.v.).
 */
export async function addAttachment(projectId, taskId, { fileName, fileUrl }) {
  const res = await request(`/api/projects/${projectId}/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: { file_name: fileName, file_url: fileUrl },
  })
  return res?.data
}

export async function deleteAttachment(projectId, taskId, attachmentId) {
  await request(
    `/api/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
    { method: 'DELETE' },
  )
  return true
}

/**
 * Upload file lên Supabase Storage (đi qua backend proxy).
 * Backend: nhận file multipart → upload Supabase → insert DB → trả attachment row.
 *
 * Dùng XMLHttpRequest để có upload progress event — fetch chưa hỗ trợ progress.
 * onProgress(percent) gọi mỗi khi byte được gửi đi.
 */
export function uploadAttachment(projectId, taskId, file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `/api/projects/${projectId}/tasks/${taskId}/attachments/upload`,
    )
    // Đính kèm JWT theo cùng pattern fetch wrapper
    const token = localStorage.getItem('sw.token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    }

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload?.data)
        } else {
          reject(
            new Error(
              payload?.error || `Upload thất bại (HTTP ${xhr.status})`,
            ),
          )
        }
      } catch (err) {
        reject(new Error(err.message || 'Upload thất bại'))
      }
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi upload'))
    xhr.send(formData)
  })
}
