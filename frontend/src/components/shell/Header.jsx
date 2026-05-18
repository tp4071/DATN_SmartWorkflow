import { Link } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { ROUTE_PATHS, ROLES } from '../../router/paths'
import { Icon } from '../ui/Icon'
import { NotificationBell } from './NotificationBell'
import { UserMenu } from './UserMenu'

export function Header() {
  const { user } = useAuth()
  const homeTo =
    user?.role === ROLES.ADMIN ? ROUTE_PATHS.admin.dashboard : ROUTE_PATHS.myProjects

  return (
    <header className="bg-white border-b border-neutral-200 flex justify-between items-center h-header-height px-container-padding w-full shrink-0 sticky top-0 md:top-0 z-20">
      <Link to={homeTo} className="flex items-center gap-3 cursor-pointer">
        <Icon name="account_tree" filled className="text-primary-900 text-2xl" />
        <span className="text-xl font-bold text-primary-900 tracking-tight hidden sm:inline">
          Smart Workflow
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <button
          className="w-10 h-10 items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-outline hidden sm:flex"
          title="Trợ giúp"
        >
          <Icon name="help_outline" />
        </button>

        <UserMenu />
      </div>
    </header>
  )
}
