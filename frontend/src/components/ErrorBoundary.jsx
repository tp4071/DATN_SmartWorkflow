import { Component } from 'react'
import { Button, Icon } from './ui'

/**
 * ErrorBoundary toàn cục — bắt mọi lỗi runtime trong subtree React.
 * Khi gặp lỗi, hiển thị 1 fallback page thay vì màn trắng.
 *
 * Phải dùng class component vì hook chưa hỗ trợ componentDidCatch.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const message = this.state.error?.message ?? 'Lỗi không xác định.'

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-neutral-50">
        <div className="max-w-md w-full bg-white border border-neutral-200 rounded-xl p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-danger-50 text-danger-500 flex items-center justify-center mb-4">
            <Icon name="error" filled className="text-3xl" />
          </div>
          <h1 className="text-h2 font-h2 text-on-surface mb-2">
            Đã có lỗi xảy ra
          </h1>
          <p className="text-sm text-on-surface-variant mb-2">
            Hệ thống gặp sự cố không lường trước được. Bạn có thể thử tải lại trang.
          </p>
          <code className="text-xs text-error bg-danger-50 border border-error-container rounded px-2 py-1 mb-6 max-w-full overflow-x-auto">
            {message}
          </code>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="ghost" onClick={this.handleHome}>
              <Icon name="home" className="text-[18px]" />
              Về trang chủ
            </Button>
            <Button onClick={this.handleReload}>
              <Icon name="refresh" className="text-[18px]" />
              Tải lại trang
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
