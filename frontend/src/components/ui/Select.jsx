import { Icon } from './Icon'

/**
 * Dropdown lọc / chọn giá trị, dùng <select> native được style đồng nhất.
 * Props:
 *   value, onChange (nhận trực tiếp string mới)
 *   options: Array<{ value: string, label: string, disabled?: bool }>
 *   placeholder?: string  // hiện thành option giá trị "" ở đầu danh sách (nếu cần)
 *   id, name, disabled, className
 *   widthClass?: string (mặc định 'w-auto')
 *   size?: 'sm' | 'md'
 *   ariaLabel?: string
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder,
  id,
  name,
  disabled = false,
  className = '',
  widthClass = 'w-auto',
  size = 'md',
  ariaLabel,
}) {
  const heightCls = size === 'sm' ? 'h-9 text-sm' : 'h-10 text-sm'
  return (
    <div className={`relative ${widthClass} ${className}`}>
      <select
        id={id}
        name={name}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`${heightCls} w-full appearance-none pl-3 pr-8 border border-neutral-200 rounded-lg bg-white text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container disabled:bg-neutral-50 disabled:text-outline transition-colors`}
      >
        {placeholder ? (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="expand_more"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[20px] pointer-events-none"
      />
    </div>
  )
}
