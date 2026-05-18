import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { ROUTE_PATHS } from '../../router/paths'
import { Icon } from '../ui/Icon'
import { Avatar } from '../ui/Avatar'
import { ChangePasswordModal } from '../auth/ChangePasswordModal'

/**
 * Dropdown menu kích hoạt từ avatar + tên user trên Header.
 * Items:
 *   - Đổi mật khẩu  → mở ChangePasswordModal
 *   - Đăng xuất     → useAuth().logout() + navigate /login
 */
export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const wrapRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const handleLogout = () => {
    logout()
    setOpen(false)
    navigate(ROUTE_PATHS.login, { replace: true })
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 border-l border-neutral-200 hover:bg-neutral-50 rounded-lg pr-2 py-1 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="text-right hidden md:block">
          <div className="font-semibold text-sm text-on-surface leading-tight">
            {user.name}
          </div>
          <div className="text-[11px] text-outline">{user.title}</div>
        </div>
        <Avatar initials={user.initials} size="sm" />
        <Icon
          name="expand_more"
          className={`text-outline text-[18px] hidden md:block transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 rounded-xl shadow-xl z-50 overflow-hidden fade-in"
        >
          <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-25">
            <div className="font-semibold text-sm text-on-surface truncate">{user.name}</div>
            <div className="text-xs text-on-surface-variant truncate">{user.email}</div>
            {user.title ? (
              <div className="text-[11px] text-outline mt-0.5">{user.title}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setPwOpen(true)
            }}
            role="menuitem"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-neutral-50 transition-colors text-left"
          >
            <Icon name="lock_reset" className="text-outline text-[20px]" />
            Đổi mật khẩu
          </button>

          <div className="border-t border-neutral-200" />

          <button
            type="button"
            onClick={handleLogout}
            role="menuitem"
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 transition-colors text-left"
          >
            <Icon name="logout" className="text-[20px]" />
            Đăng xuất
          </button>
        </div>
      ) : null}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}
