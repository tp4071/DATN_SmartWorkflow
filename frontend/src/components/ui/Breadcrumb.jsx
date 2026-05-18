import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export function Breadcrumb({ items = [] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-outline mb-2">
      {items.map((it, i) => {
        const last = i === items.length - 1
        const sep =
          i < items.length - 1 ? (
            <Icon key={`sep-${i}`} name="chevron_right" className="text-[14px]" />
          ) : null

        const node = last ? (
          <span key={`item-${i}`} className="text-on-surface font-semibold">
            {it.label}
          </span>
        ) : it.to ? (
          <Link
            key={`item-${i}`}
            to={it.to}
            className="hover:text-primary-container transition-colors"
          >
            {it.label}
          </Link>
        ) : (
          <span key={`item-${i}`}>{it.label}</span>
        )

        return (
          <span key={`wrap-${i}`} className="flex items-center gap-1">
            {node}
            {sep}
          </span>
        )
      })}
    </nav>
  )
}
