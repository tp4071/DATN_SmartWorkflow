import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './useAuth'
import { getSocket, disconnectSocket } from '../services/socket'
import {
  listNotifications,
  markAllNotificationsRead,
} from '../services/notifications.api'

const MAX_ITEMS = 200 // giữ trong RAM tối đa, đủ rộng cho UI

const NotificationContext = createContext(null)

function dedupById(items) {
  const seen = new Set()
  const out = []
  for (const n of items) {
    if (!n?.id || seen.has(n.id)) continue
    seen.add(n.id)
    out.push(n)
  }
  return out
}

/**
 * Quản lý notification:
 *  - Khi đăng nhập: gọi GET /api/notifications để lấy lịch sử (đã persist trong
 *    activity_logs) — user offline khi event xảy ra vẫn thấy lại được.
 *  - Khi nhận event 'notification' qua Socket.IO: prepend vào list (dedup).
 *  - markAllRead: gọi PUT /mark-all-read rồi cập nhật is_read local.
 *
 * Server dùng cột notifications_seen_at (1 timestamp) để track unread.
 * "Đánh dấu đã đọc" áp dụng cho TOÀN BỘ; mark từng item chỉ ảnh hưởng UI.
 */
export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const [items, setItems] = useState([])
  const [serverUnreadCount, setServerUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket()
      socketRef.current = null
      setItems([])
      setServerUnreadCount(0)
      setError(null)
      return undefined
    }

    let cancelled = false

    setLoading(true)
    setError(null)
    listNotifications({ limit: 50, offset: 0 })
      .then((data) => {
        if (cancelled) return
        setItems(data.items ?? [])
        setServerUnreadCount(data.unreadCount ?? 0)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Không tải được thông báo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const socket = getSocket()
    socketRef.current = socket
    if (!socket) return () => { cancelled = true }

    const onNotification = (payload) => {
      setItems((prev) => {
        const next = dedupById([{ ...payload, is_read: false }, ...prev])
        return next.length > MAX_ITEMS ? next.slice(0, MAX_ITEMS) : next
      })
      setServerUnreadCount((c) => c + 1)
    }

    socket.on('notification', onNotification)
    return () => {
      cancelled = true
      socket.off('notification', onNotification)
    }
  }, [isAuthenticated, user?.id])

  const unreadCount = useMemo(
    () => items.filter((n) => !n.is_read).length,
    [items],
  )

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setServerUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch (err) {
      console.error('markAllRead failed:', err.message)
    }
  }, [])

  const markAsRead = useCallback((id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }, [])

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const onSocketEvent = useCallback((eventName, handler) => {
    const socket = socketRef.current ?? getSocket()
    if (!socket) return () => {}
    socket.on(eventName, handler)
    return () => socket.off(eventName, handler)
  }, [])

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      serverUnreadCount,
      loading,
      error,
      markAllRead,
      markAsRead,
      remove,
      onSocketEvent,
    }),
    [items, unreadCount, serverUnreadCount, loading, error, markAllRead, markAsRead, remove, onSocketEvent],
  )

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within <NotificationProvider>')
  return ctx
}
