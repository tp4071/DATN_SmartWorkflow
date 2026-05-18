const TOKEN_KEY = 'sw.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const token = getToken()
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...(headers || {}),
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(path, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError('Không thể kết nối tới máy chủ. Vui lòng thử lại.', 0)
  }

  let payload = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!res.ok) {
    const message =
      payload?.error ||
      payload?.message ||
      (res.status >= 500 ? 'Máy chủ gặp sự cố. Vui lòng thử lại.' : 'Yêu cầu không hợp lệ.')
    if (res.status === 401 && getToken()) {
      // Token hết hạn / không hợp lệ — báo cho lớp auth dọn state.
      setToken(null)
      window.dispatchEvent(new CustomEvent('sw:unauthorized', { detail: { message } }))
    }
    throw new ApiError(message, res.status, payload?.details ?? null)
  }

  return payload
}
