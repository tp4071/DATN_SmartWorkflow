const PALETTE = [
  'bg-primary-100 text-primary-900',
  'bg-secondary-100 text-secondary-900',
  'bg-tertiary-100 text-tertiary-900',
  'bg-success-50 text-success-600',
]

function colorFor(initials) {
  const seed = initials || 'XX'
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function Avatar({ initials, size = 'sm', className = '' }) {
  const sizeCls = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  }[size] ?? 'w-8 h-8 text-xs'

  return (
    <div
      className={`${sizeCls} rounded-full ${colorFor(initials)} flex items-center justify-center font-bold border border-white ${className}`}
      title={initials || ''}
    >
      {initials || '?'}
    </div>
  )
}
