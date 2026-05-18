export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-2">
      <div>
        <h1 className="text-h1 font-h1 text-on-surface tracking-tight">{title}</h1>
        {description ? (
          <p className="text-on-surface-variant text-sm mt-1">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
