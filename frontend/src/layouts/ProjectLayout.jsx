import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { ProjectProvider, useProject } from '../context/ProjectContext'
import { Spinner, EmptyState, Button, Icon } from '../components/ui'
import { ROUTE_PATHS } from '../router/paths'

/**
 * Wrap mọi route /project/:projectId/* để:
 *   1. Fetch chi tiết dự án 1 lần (kèm current_user_role).
 *   2. Cung cấp ProjectContext cho mọi page con + Sidebar.
 *   3. Hiển thị loading / 403 / 404 thống nhất, không để page con chịu trùng lặp.
 */
function ProjectShell() {
  const { project, loading, error, refresh } = useProject()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[40vh]">
        <Spinner size="lg" label="Đang tải dự án..." />
      </div>
    )
  }

  if (error) {
    const isForbidden = error.status === 403
    const isNotFound = error.status === 404
    return (
      <EmptyState
        icon={isForbidden ? 'lock' : isNotFound ? 'folder_off' : 'error'}
        title={
          isForbidden
            ? 'Bạn không có quyền truy cập dự án này'
            : isNotFound
              ? 'Không tìm thấy dự án'
              : 'Không tải được dự án'
        }
        description={error.message}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate(ROUTE_PATHS.myProjects)}>
              <Icon name="arrow_back" className="text-[18px]" />
              Về danh sách
            </Button>
            {!isForbidden && !isNotFound ? (
              <Button onClick={refresh}>
                <Icon name="refresh" className="text-[18px]" />
                Thử lại
              </Button>
            ) : null}
          </div>
        }
      />
    )
  }

  if (!project) return null
  return <Outlet />
}

export function ProjectLayout() {
  const { projectId } = useParams()
  return (
    <ProjectProvider projectId={projectId}>
      <ProjectShell />
    </ProjectProvider>
  )
}
