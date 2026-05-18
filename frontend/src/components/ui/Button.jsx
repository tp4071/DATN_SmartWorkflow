const VARIANTS = {
  primary:
    'bg-primary-container text-white hover:bg-primary-900 border border-primary-container',
  secondary:
    'bg-secondary-700 text-white hover:bg-secondary-900 border border-secondary-700',
  ghost:
    'bg-white text-on-surface hover:bg-neutral-50 border border-neutral-200',
  danger:
    'bg-danger-500 text-white hover:bg-danger-500/90 border border-danger-500',
  link: 'bg-transparent text-primary-container hover:underline border-0 px-0',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className,
  ].join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}
