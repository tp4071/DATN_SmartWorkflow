import { Icon } from './Icon'

/**
 * Ô tìm kiếm có icon kính lúp + nút xóa nhanh.
 * Props:
 *   value, onChange (nhận trực tiếp string mới)
 *   placeholder, className, disabled, name, id
 *   onSubmit?: () => void  // gọi khi nhấn Enter (tùy chọn)
 *   widthClass?: 'w-full' | 'w-64' | 'w-72' ... (mặc định 'w-full')
 *   size?: 'sm' | 'md' (mặc định 'md')
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  className = '',
  disabled = false,
  name,
  id,
  onSubmit,
  widthClass = 'w-full',
  size = 'md',
}) {
  const heightCls = size === 'sm' ? 'h-9 text-sm' : 'h-10 text-sm'
  const showClear = !!value && !disabled

  return (
    <div className={`relative ${widthClass} ${className}`}>
      <Icon
        name="search"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none"
      />
      <input
        id={id}
        name={name}
        type="search"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`${heightCls} w-full pl-10 ${
          showClear ? 'pr-9' : 'pr-3'
        } border border-neutral-200 rounded-lg bg-white text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container disabled:bg-neutral-50 disabled:text-outline transition-colors`}
      />
      {showClear ? (
        <button
          type="button"
          onClick={() => onChange?.('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-outline hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          aria-label="Xóa từ khóa"
          tabIndex={-1}
        >
          <Icon name="close" className="text-[16px]" />
        </button>
      ) : null}
    </div>
  )
}
