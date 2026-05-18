import { Navigate, Route, Routes } from 'react-router-dom'
import { ROUTE_PATHS, ROLES } from './paths'
import { ProtectedRoute, PublicOnlyRoute } from './guards'
import { AppLayout } from '../layouts/AppLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { ProjectLayout } from '../layouts/ProjectLayout'

import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { NotificationsPage } from '../pages/NotificationsPage'
import { MyTasksPage } from '../pages/MyTasksPage'

import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage'
import { AdminUsersPage } from '../pages/admin/AdminUsersPage'
import { AdminProjectsPage } from '../pages/admin/AdminProjectsPage'
import { AdminStatsPage } from '../pages/admin/AdminStatsPage'

import { MyProjectsPage } from '../pages/projects/MyProjectsPage'
import { ProjectBoardPage } from '../pages/projects/ProjectBoardPage'
import { ProjectMembersPage } from '../pages/projects/ProjectMembersPage'
import { ProjectProposalsPage } from '../pages/projects/ProjectProposalsPage'
import { ProjectAITasksPage } from '../pages/projects/ProjectAITasksPage'
import { ProjectStatsPage } from '../pages/projects/ProjectStatsPage'
import { ProjectAIReportPage } from '../pages/projects/ProjectAIReportPage'
import { ProjectSuggestPage } from '../pages/projects/ProjectSuggestPage'

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route
          path={ROUTE_PATHS.login}
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
      </Route>

      <Route path={ROUTE_PATHS.root} element={<Navigate to={ROUTE_PATHS.login} replace />} />

      {/* Authenticated app shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Admin */}
        <Route
          path={ROUTE_PATHS.admin.dashboard}
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.admin.users}
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.admin.projects}
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTE_PATHS.admin.stats}
          element={
            <ProtectedRoute roles={[ROLES.ADMIN]}>
              <AdminStatsPage />
            </ProtectedRoute>
          }
        />

        {/* Common */}
        <Route path={ROUTE_PATHS.myProjects} element={<MyProjectsPage />} />
        <Route path={ROUTE_PATHS.myTasks} element={<MyTasksPage />} />
        <Route path={ROUTE_PATHS.notifications} element={<NotificationsPage />} />

        {/* Project-scoped: ProjectLayout cung cấp ProjectContext cho mọi page con */}
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route path="board" element={<ProjectBoardPage />} />
          <Route path="members" element={<ProjectMembersPage />} />
          <Route path="proposals" element={<ProjectProposalsPage />} />
          <Route path="ai-tasks" element={<ProjectAITasksPage />} />
          <Route path="suggest" element={<ProjectSuggestPage />} />
          <Route path="stats" element={<ProjectStatsPage />} />
          <Route path="ai-report" element={<ProjectAIReportPage />} />
        </Route>

        <Route path={ROUTE_PATHS.notFound} element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
