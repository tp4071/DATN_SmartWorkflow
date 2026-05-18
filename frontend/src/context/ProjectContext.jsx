import { createContext, useContext, useMemo } from 'react'
import { useProjectQuery } from '../hooks/useProjectQueries'

/**
 * Project-level role của user hiện tại trong dự án.
 *  - 'ADMIN'   : user có system_role ADMIN, có quyền xem mọi dự án
 *  - 'MANAGER' : PM của dự án này
 *  - 'MEMBER'  : thành viên thường
 *
 * Các giá trị này khớp với backend `GET /api/projects/:id` -> `current_user_role`.
 */
export const PROJECT_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
}

const ProjectContext = createContext(null)

/**
 * Provider dùng React Query (`useProjectQuery`) để cache + dedupe `GET /projects/:id`.
 * Khi user điều hướng qua các page con (board → members → stats), data project được
 * tái sử dụng từ cache trong staleTime, không gây flicker.
 */
export function ProjectProvider({ projectId, children }) {
  const query = useProjectQuery(projectId)
  const project = query.data ?? null

  const value = useMemo(
    () => ({
      project,
      projectId,
      projectRole: project?.current_user_role ?? null,
      isManager: project?.current_user_role === PROJECT_ROLES.MANAGER,
      isAdmin: project?.current_user_role === PROJECT_ROLES.ADMIN,
      // canManage = chỉ PM của dự án. Admin chỉ có quyền XEM (read-only).
      canManage: project?.current_user_role === PROJECT_ROLES.MANAGER,
      // readOnly = true khi user vào project mà KHÔNG được thao tác gì
      // (Admin = system-admin chỉ xem). Member thường vẫn được làm task của
      // mình nên readOnly = false cho họ.
      readOnly: project?.current_user_role === PROJECT_ROLES.ADMIN,
      loading: query.isLoading,
      error: query.isError
        ? {
            message: query.error?.message || 'Không tải được thông tin dự án.',
            status: query.error?.status,
          }
        : null,
      refresh: () => query.refetch(),
    }),
    [project, projectId, query.isLoading, query.isError, query.error, query.refetch],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

/** Trả null nếu component không nằm trong ProjectProvider (Sidebar dùng được ngoài project routes). */
export function useProjectContext() {
  return useContext(ProjectContext)
}

/** Bắt buộc phải có context — dùng trong các page project khi đã đảm bảo wrap. */
export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within <ProjectProvider>')
  return ctx
}
