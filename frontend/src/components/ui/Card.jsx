export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-neutral-200 ${className}`}>{children}</div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-25 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-4 ${className}`}>{children}</div>
}
