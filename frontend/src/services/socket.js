import { io } from 'socket.io-client'
import { getToken } from './http'

let socket = null

/**
 * Singleton Socket.IO connection.
 * - Auth bằng JWT (lấy từ localStorage qua getToken).
 * - Lazy: chỉ connect khi `getSocket()` được gọi lần đầu (sau khi user đăng nhập).
 * - Auto reconnect mặc định của socket.io-client (không config thêm).
 *
 * Về URL: ở dev, Vite proxy `/socket.io` sang backend nên dùng cùng origin.
 * Ở prod, có thể đổi sang env VITE_SOCKET_URL.
 */
export function getSocket() {
  if (socket) return socket

  const token = getToken()
  if (!token) return null

  const url = import.meta.env.VITE_SOCKET_URL || undefined // undefined = same origin
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })

  if (import.meta.env.DEV) {
    socket.on('connect', () => console.log('🔌 socket connected', socket.id))
    socket.on('disconnect', (reason) => console.log('🔌 socket disconnected', reason))
    socket.on('connect_error', (err) => console.warn('🔌 socket connect_error', err.message))
  }

  return socket
}

/** Đóng kết nối hiện tại (gọi khi logout). */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

/** Subscribe client tới project room (live updates board / detail). */
export function subscribeProject(projectId) {
  const s = getSocket()
  if (!s || !projectId) return
  s.emit('project:subscribe', projectId)
}

export function unsubscribeProject(projectId) {
  const s = getSocket()
  if (!s || !projectId) return
  s.emit('project:unsubscribe', projectId)
}
