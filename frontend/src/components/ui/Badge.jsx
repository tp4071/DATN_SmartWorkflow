const PRIORITY = {
  HIGH: { cls: 'bg-danger-50 text-danger-500 border-danger-500/20', label: 'Cao' },
  MEDIUM: { cls: 'bg-tertiary-50 text-tertiary-700 border-tertiary-700/20', label: 'Trung bình' },
  LOW: { cls: 'bg-neutral-100 text-neutral-700 border-neutral-300', label: 'Thấp' },
}

const STATUS = {
  todo: { cls: 'bg-neutral-100 text-neutral-700 border-neutral-300', label: 'Cần làm' },
  inprog: { cls: 'bg-primary-50 text-primary-700 border-primary-100', label: 'Đang làm' },
  review: { cls: 'bg-tertiary-50 text-tertiary-900 border-tertiary-300', label: 'Chờ đánh giá' },
  done: { cls: 'bg-success-50 text-success-600 border-success-600/20', label: 'Hoàn thành' },
}

export function PriorityBadge({ priority = 'MEDIUM' }) {
  const m = PRIORITY[priority] ?? PRIORITY.MEDIUM
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}>
      {m.label}
    </span>
  )
}

export function StatusBadge({ status = 'todo' }) {
  const m = STATUS[status] ?? STATUS.todo
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${m.cls}`}>
      {m.label}
    </span>
  )
}

export function Pill({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    success: 'bg-success-50 text-success-600 border-success-600/20',
    danger: 'bg-danger-50 text-danger-500 border-danger-500/20',
    warning: 'bg-tertiary-50 text-tertiary-700 border-tertiary-300',
    info: 'bg-secondary-50 text-secondary-700 border-secondary-100',
  }
  const tone_ = tones[tone] ?? tones.neutral
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tone_} ${className}`}
    >
      {children}
    </span>
  )
}
