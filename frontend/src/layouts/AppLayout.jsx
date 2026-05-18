import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROUTE_PATHS } from '../router/paths'
import { Header } from '../components/shell/Header'
import { Sidebar } from '../components/shell/Sidebar'
import { Footer } from '../components/shell/Footer'

export function AppLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate(ROUTE_PATHS.login, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar onLogout={handleLogout} />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <main className="flex-1 p-container-padding flex flex-col gap-stack-gap min-w-0">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
