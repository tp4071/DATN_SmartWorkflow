import { Icon } from './Icon'

export function EmptyState({
  icon = 'inbox',
  title = 'Chưa có dữ liệu',
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-dashed border-neutral-200 rounded-xl">
      <div className="w-12 h-12 rounded-full bg-neutral-50 text-outline flex items-center justify-center mb-4">
        <Icon name={icon} className="text-[24px]" />
      </div>
      <h3 className="text-h3 font-h3 text-on-surface">{title}</h3>
      {description ? (
        <p className="text-sm text-on-surface-variant mt-1 max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function PageStub({ title, description }) {
  return (
    <EmptyState
      icon="construction"
      title={title || 'Khung giao diện'}
      description={
        description ||
        'Màn hình đã được khởi tạo. Phần chức năng sẽ được phát triển trong các bước tiếp theo.'
      }
    />
  )
}
