import { NavLink, useMatch } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { PROJECT_ROLES } from '../../context/ProjectContext'
import { useProjectQuery } from '../../hooks/useProjectQueries'
import { ROUTE_PATHS, ROLES } from '../../router/paths'
import { Icon } from '../ui/Icon'

function buildItems({ systemRole, projectId, project, canManage, isReadOnly }) {
  if (systemRole === ROLES.ADMIN && !projectId) {
    return [
      { icon: 'dashboard', label: 'Tổng quan', to: ROUTE_PATHS.admin.dashboard },
      { icon: 'group', label: 'Quản lý nhân sự', to: ROUTE_PATHS.admin.users },
      { icon: 'folder_special', label: 'Quản lý dự án', to: ROUTE_PATHS.admin.projects },
      { icon: 'leaderboard', label: 'Thống kê hệ thống', to: ROUTE_PATHS.admin.stats },
      { icon: 'notifications', label: 'Thông báo', to: ROUTE_PATHS.notifications },
    ]
  }

  const items = [
    systemRole === ROLES.ADMIN
      ? { icon: 'folder_special', label: 'Quản lý dự án', to: ROUTE_PATHS.admin.projects }
      : { icon: 'assignment_ind', label: 'Dự án của tôi', to: ROUTE_PATHS.myProjects },
  ]

  if (systemRole !== ROLES.ADMIN) {
    items.push({ icon: 'task_alt', label: 'Công việc của tôi', to: ROUTE_PATHS.myTasks })
  }

  items.push({ icon: 'notifications', label: 'Thông báo', to: ROUTE_PATHS.notifications })

  if (projectId) {
    const projectLabel = project?.name
      ? project.name.length > 22
        ? project.name.slice(0, 22) + '…'
        : project.name
      : 'Dự án'
    items.push({ separator: projectLabel })
    items.push({
      icon: 'view_kanban',
      label: 'Bảng công việc',
      to: ROUTE_PATHS.project.board(projectId),
    })

    // "Thành viên" cho mọi user trong project (read-only nếu không phải PM/Admin).
    items.push({
      icon: 'group',
      label: 'Thành viên',
      to: ROUTE_PATHS.project.members(projectId),
    })

    if (canManage) {
      items.push({
        icon: 'description',
        label: 'Đề xuất chờ duyệt',
        to: ROUTE_PATHS.project.proposals(projectId),
      })
      items.push({
        icon: 'auto_awesome',
        label: 'AI tách task',
        to: ROUTE_PATHS.project.aiTasks(projectId),
        special: true,
      })
    } else if (!isReadOnly) {
      // Member thường: có nút Đề xuất công việc. Admin (read-only) ẩn nút này.
      items.push({
        icon: 'lightbulb',
        label: 'Đề xuất công việc',
        to: ROUTE_PATHS.project.suggest(projectId),
      })
    }

    items.push({
      icon: 'leaderboard',
      label: 'Thống kê',
      to: ROUTE_PATHS.project.stats(projectId),
    })

    if (canManage) {
      items.push({
        icon: 'auto_awesome',
        label: 'Báo cáo AI',
        to: ROUTE_PATHS.project.aiReport(projectId),
        special: true,
      })
    }
  }

  return items
}

function SidebarItem({ to, icon, label, special }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
          isActive
            ? 'bg-primary-50 text-primary-900 border-r-4 border-primary-900 font-semibold'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={icon}
            filled={isActive}
            className={special ? 'text-secondary-700' : ''}
          />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ onLogout }) {
  const { role: systemRole } = useAuth()
  const projectMatch = useMatch('/project/:projectId/*')
  const projectId = projectMatch?.params?.projectId ?? null

  // Sidebar nằm ngoài ProjectProvider (ở AppLayout) nên không dùng được context.
  // Tự gọi useProjectQuery — React Query share cache với ProjectLayout, không tốn
  // thêm request. Khi projectId null (route admin), `enabled: false` → không fetch.
  const { data: project } = useProjectQuery(projectId)

  // Admin chỉ có quyền xem trong dự án — không hiển thị các mục "PM-only"
  // như Đề xuất chờ duyệt, AI tách task, Báo cáo AI.
  const canManage = project?.current_user_role === PROJECT_ROLES.MANAGER

  const isReadOnly = project?.current_user_role === PROJECT_ROLES.ADMIN

  const items = buildItems({
    systemRole,
    projectId,
    project,
    canManage,
    isReadOnly,
  })

  return (
    <aside className="hidden md:flex sticky top-0 self-start h-screen w-sidebar-width bg-neutral-50 border-r border-neutral-200 z-30">
      <nav className="flex flex-col gap-1 py-4 px-3 w-full overflow-y-auto scrollbar-thin">
        <div className="mb-4 px-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-container rounded-lg flex items-center justify-center text-white font-bold text-sm">
            SW
          </div>
          <div>
            <div className="text-xs font-bold text-primary-900 leading-tight">
              Smart Workflow
            </div>
            <div className="text-[10px] text-outline">v1.0 · 2026</div>
          </div>
        </div>

        {items.map((it, i) =>
          it.separator ? (
            <div
              key={`sep-${i}`}
              className="px-3 mt-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-outline truncate"
              title={project?.name ?? undefined}
            >
              {it.separator}
            </div>
          ) : (
            <SidebarItem
              key={it.to}
              to={it.to}
              icon={it.icon}
              label={it.label}
              special={it.special}
            />
          ),
        )}

        <div className="mt-auto pt-4 border-t border-neutral-200 flex flex-col gap-1">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-700 hover:bg-danger-50 hover:text-danger-500 transition-all text-sm w-full text-left"
          >
            <Icon name="logout" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}
