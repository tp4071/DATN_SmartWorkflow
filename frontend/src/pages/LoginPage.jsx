import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ROUTE_PATHS, ROLES } from '../router/paths'
import { Icon } from '../components/ui/Icon'


const targetForRole = (role) =>
  role === ROLES.ADMIN ? ROUTE_PATHS.admin.dashboard : ROUTE_PATHS.myProjects

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState({ email: false, password: false })

  const emailInvalid =
    touched.email && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
  const passwordInvalid = touched.password && !password

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!email.trim() || !password) return

    setSubmitting(true)
    setError(null)
    try {
      const profile = await login({ email: email.trim(), password })
      navigate(targetForRole(profile.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <main className="flex-1 flex flex-col md:flex-row w-full min-h-screen">
        <section className="hidden md:flex flex-col justify-center items-start w-1/2 p-12 lg:p-24 bg-primary-container text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, #ffffff 1px, transparent 1px), radial-gradient(circle at 80% 70%, #ffffff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative z-10 max-w-lg">
            <div className="flex items-center gap-3 mb-8">
              <Icon name="account_tree" filled className="text-4xl" />
              <span className="text-2xl font-bold tracking-tight">Smart Workflow</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 tracking-tight">
              Hệ thống quản trị công việc
            </h1>
            <div className="inline-flex items-center gap-2 bg-primary px-4 py-2 rounded-lg border border-primary-700">
              <Icon name="auto_awesome" className="text-secondary-300 text-sm" />
              <span className="font-semibold text-sm text-primary-100">Tích hợp AI</span>
            </div>
            <p className="mt-8 text-primary-100 opacity-80 max-w-md">
              Nền tảng quản lý dự án học thuật và doanh nghiệp, cung cấp giải pháp theo dõi tiến
              độ và phân tích dữ liệu tự động.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-4 max-w-md text-primary-100">
              {[
                { icon: 'view_kanban', label: 'Kanban Board' },
                { icon: 'smart_toy', label: 'AI tách task' },
                { icon: 'analytics', label: 'AI báo cáo' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col gap-1">
                  <Icon name={f.icon} className="text-secondary-300" />
                  <span className="text-xs">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 lg:p-24 bg-neutral-50 relative">
          <div className="md:hidden flex items-center gap-2 mb-8 text-primary-container">
            <Icon name="account_tree" filled className="text-2xl" />
            <span className="text-2xl font-bold">Smart Workflow</span>
          </div>

          <div className="w-full max-w-[420px] bg-white border border-neutral-200 rounded-lg p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">Đăng nhập</h2>
              <p className="text-sm text-on-surface-variant">
                Vui lòng điền thông tin để tiếp tục
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-danger-50 border border-error-container text-error text-sm fade-in"
              >
                <Icon name="error" filled className="text-base mt-0.5" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-error/70 hover:text-error"
                  aria-label="Đóng thông báo"
                >
                  <Icon name="close" className="text-base" />
                </button>
              </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="Nhập email của bạn"
                  disabled={submitting}
                  aria-invalid={emailInvalid || undefined}
                  className={`w-full h-10 px-3 bg-white border rounded-lg text-sm text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-outline ${
                    emailInvalid
                      ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                      : 'border-neutral-200 focus:border-primary-container focus:ring-1 focus:ring-primary-container'
                  }`}
                />
                {emailInvalid && (
                  <span className="text-xs text-error">
                    {email.trim() ? 'Email không đúng định dạng.' : 'Vui lòng nhập email.'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-neutral-700" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder="Nhập mật khẩu"
                    disabled={submitting}
                    aria-invalid={passwordInvalid || undefined}
                    className={`w-full h-10 px-3 pr-10 bg-white border rounded-lg text-sm text-neutral-900 outline-none transition-colors disabled:bg-neutral-50 disabled:text-outline ${
                      passwordInvalid
                        ? 'border-error focus:border-error focus:ring-1 focus:ring-error'
                        : 'border-neutral-200 focus:border-primary-container focus:ring-1 focus:ring-primary-container'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-neutral-700"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    tabIndex={-1}
                  >
                    <Icon name={showPassword ? 'visibility' : 'visibility_off'} className="text-sm" />
                  </button>
                </div>
                {passwordInvalid && (
                  <span className="text-xs text-error">Vui lòng nhập mật khẩu.</span>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-container focus:ring-primary-container"
                  />
                  <span className="text-sm text-neutral-700">Ghi nhớ đăng nhập</span>
                </label>
                <a
                  className="text-sm font-semibold text-primary-container hover:text-primary-700 hover:underline"
                  href="#"
                >
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 bg-primary-container text-white font-semibold text-sm rounded-lg hover:bg-primary-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Icon name="progress_activity" className="text-sm spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <Icon name="arrow_forward" className="text-sm" />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="w-full py-4 border-t border-neutral-200 bg-white flex flex-col md:flex-row justify-between items-center px-8 gap-4 text-xs text-outline">
        <div className="text-neutral-700 opacity-80">
          © 2026 Smart Workflow – Đồ án tốt nghiệp – Phạm Đức Tỉnh – ĐHCNHN
        </div>
        <div className="flex gap-4">
          <a className="hover:text-primary-700 transition-colors" href="#">
            Documentation
          </a>
          <a className="hover:text-primary-700 transition-colors" href="#">
            Privacy Policy
          </a>
          <a className="hover:text-primary-700 transition-colors" href="#">
            Support
          </a>
        </div>
      </footer>
    </>
  )
}
