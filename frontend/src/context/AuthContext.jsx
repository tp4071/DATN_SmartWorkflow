import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { ROLES } from '../router/paths'
import { loginRequest } from '../services/auth.api'
import { getToken, setToken } from '../services/http'

const USER_STORAGE_KEY = 'sw.user'

function makeInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Backend phân biệt ADMIN / USER ở cấp hệ thống. Vai trò MANAGER/MEMBER thuộc cấp dự án và
// được xác định khi user truy cập từng project (qua bảng project_members). Ở cấp toàn cục,
// non-admin user được map sang ROLES.MEMBER cho UI default.
function normalizeApiUser(apiUser) {
  const role = apiUser.system_role === 'ADMIN' ? ROLES.ADMIN : ROLES.MEMBER
  return {
    id: apiUser.id,
    name: apiUser.full_name,
    email: apiUser.email,
    systemRole: apiUser.system_role,
    role,
    initials: makeInitials(apiUser.full_name),
    title: role === ROLES.ADMIN ? 'Quản trị viên' : 'Người dùng',
  }
}

function readPersistedUser() {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && parsed.role ? parsed : null
  } catch {
    return null
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? readPersistedUser() : null))

  useEffect(() => {
    if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_STORAGE_KEY)
  }, [user])

  // http.js dispatch sự kiện này khi nhận 401 (token hết hạn) — kéo state về null
  // để ProtectedRoute đẩy user về /login.
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('sw:unauthorized', onUnauthorized)
    return () => window.removeEventListener('sw:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const data = await loginRequest({ email, password })
    if (!data?.token || !data?.user) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.')
    }
    setToken(data.token)
    const normalized = normalizeApiUser(data.user)
    setUser(normalized)
    return normalized
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      role: user?.role ?? null,
      login,
      logout,
    }),
    [user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }
