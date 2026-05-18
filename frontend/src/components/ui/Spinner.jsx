import { Icon } from './Icon'

export function Spinner({ size = 'md', label, className = '' }) {
  const sizeCls = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div
      className={`flex items-center justify-center gap-2 text-outline ${className}`}
      role="status"
    >
      <Icon name="progress_activity" className={`${sizeCls} spin`} />
      {label ? <span className="text-sm">{label}</span> : null}
    </div>
  )
}
