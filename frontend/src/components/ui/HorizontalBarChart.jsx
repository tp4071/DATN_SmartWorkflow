/**
 * Horizontal bar chart đơn giản dùng <div> + width %.
 * Phù hợp cho danh sách "name: value" như workload theo assignee.
 *
 * Props:
 *   data: [{ key, label, value, colorHex?, sublabel? }]
 *   maxValue?: number  (override mặc định = max trong data)
 *   emptyMessage?: string
 *   showValueOnRight?: bool (mặc định true)
 */
export function HorizontalBarChart({
  data = [],
  maxValue,
  emptyMessage = 'Chưa có dữ liệu',
  showValueOnRight = true,
  height = 'h-3',
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-outline">
        {emptyMessage}
      </div>
    )
  }

  const max = maxValue ?? Math.max(1, ...data.map((d) => d.value || 0))

  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => {
        const pct = max > 0 ? Math.round(((d.value || 0) / max) * 100) : 0
        return (
          <li key={d.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface truncate min-w-0 pr-2">{d.label}</span>
              {showValueOnRight ? (
                <span className="tabular-nums font-semibold text-on-surface shrink-0">
                  {d.value || 0}
                </span>
              ) : null}
            </div>
            <div className={`w-full bg-neutral-100 rounded-full ${height} overflow-hidden`}>
              <div
                className={`${height} rounded-full transition-all`}
                style={{
                  width: `${pct}%`,
                  backgroundColor: d.colorHex || '#1e3a8a',
                  minWidth: pct > 0 ? '2px' : 0,
                }}
              />
            </div>
            {d.sublabel ? (
              <span className="text-[11px] text-outline">{d.sublabel}</span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
