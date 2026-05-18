import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROUTE_PATHS, ROLES } from './paths'

export function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.login} replace state={{ from: location }} />
  }

  if (roles && roles.length > 0 && !roles.includes(role)) {
    const fallback = role === ROLES.ADMIN ? ROUTE_PATHS.admin.dashboard : ROUTE_PATHS.myProjects
    return <Navigate to={fallback} replace />
  }

  return children
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, role } = useAuth()
  if (isAuthenticated) {
    const target = role === ROLES.ADMIN ? ROUTE_PATHS.admin.dashboard : ROUTE_PATHS.myProjects
    return <Navigate to={target} replace />
  }
  return children
}
