import { useEffect } from 'react'
import { useToast } from './ui/Toast'

/**
 * Lắng nghe sự kiện global `sw:unauthorized` (do http.js dispatch khi nhận 401
 * có token) và bắn 1 toast cảnh báo. Sau đó AuthContext sẽ tự reset user state
 * và <ProtectedRoute> sẽ điều hướng về /login.
 *
 * Đặt KHÔNG-VIEW (return null) ngay dưới ToastProvider để có toast api.
 */
export function AuthExpiredListener() {
  const toast = useToast()
  useEffect(() => {
    let lastFired = 0
    const onUnauthorized = (e) => {
      // Tránh spam toast nếu nhiều request cùng failed 401 trong 1 cú click.
      const now = Date.now()
      if (now - lastFired < 2000) return
      lastFired = now
      const reason = e?.detail?.message
      toast.warning(
        reason && reason !== 'Token không hợp lệ hoặc đã hết hạn'
          ? reason
          : 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        { duration: 5000 },
      )
    }
    window.addEventListener('sw:unauthorized', onUnauthorized)
    return () => window.removeEventListener('sw:unauthorized', onUnauthorized)
  }, [toast])
  return null
}
