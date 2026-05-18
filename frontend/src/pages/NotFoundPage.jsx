import { Link } from 'react-router-dom'
import { ROUTE_PATHS } from '../router/paths'
import { Icon } from '../components/ui/Icon'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-container flex items-center justify-center mb-4">
        <Icon name="travel_explore" className="text-[32px]" />
      </div>
      <h2 className="text-h1 font-h1 text-on-surface mb-2">404 – Không tìm thấy trang</h2>
      <p className="text-sm text-on-surface-variant mb-6">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        to={ROUTE_PATHS.root}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary-container text-white text-sm font-semibold hover:bg-primary-900 transition-colors"
      >
        <Icon name="home" className="text-[18px]" />
        Quay về trang chủ
      </Link>
    </div>
  )
}
