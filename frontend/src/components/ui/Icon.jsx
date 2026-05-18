export function Icon({ name, filled = false, className = '' }) {
  const cls = ['material-symbols-outlined', filled ? 'filled' : '', className]
    .filter(Boolean)
    .join(' ')
  return <span className={cls}>{name}</span>
}
