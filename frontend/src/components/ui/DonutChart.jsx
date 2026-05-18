import { useMemo, useState } from 'react'

/**
 * Pure-SVG donut chart, không phụ thuộc thư viện.
 *
 * Props:
 *   data: [{ key, label, value, colorClass }]   (colorClass = stroke Tailwind class, hoặc dùng colorHex)
 *   size?: number  (mặc định 220)
 *   thickness?: number (độ dày vòng, mặc định 28)
 *   centerLabel?: string  (mặc định: tổng giá trị)
 *   centerSubLabel?: string  (mặc định: 'Tổng')
 *   emptyMessage?: string  (hiển thị khi tổng = 0)
 *
 * Cài đặt:
 *   Vẽ từng slice bằng <circle> với stroke-dasharray + stroke-dashoffset.
 *   pathLength=100 để mỗi slice có dasharray đơn giản (percent của 100).
 *   Hover slice -> highlight + tooltip cạnh chart.
 */
export function DonutChart({
  data = [],
  size = 220,
  thickness = 28,
  centerLabel,
  centerSubLabel = 'Tổng',
  emptyMessage = 'Chưa có dữ liệu',
}) {
  const [hoverIdx, setHoverIdx] = useState(null)

  const total = useMemo(() => data.reduce((s, d) => s + (d.value || 0), 0), [data])

  // Tính cumulative percentage cho từng slice
  const slices = useMemo(() => {
    if (total === 0) return []
    let acc = 0
    return data.map((d, i) => {
      const pct = ((d.value || 0) / total) * 100
      const slice = { ...d, pct, offset: -acc, idx: i }
      acc += pct
      return slice
    })
  }, [data, total])

  const radius = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2

  const empty = total === 0

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="transparent"
            stroke="#E5E5E8"
            strokeWidth={thickness}
          />
          {/* Slices */}
          {!empty &&
            slices.map((s) => (
              <circle
                key={s.key}
                cx={cx}
                cy={cy}
                r={radius}
                fill="transparent"
                stroke={s.colorHex || '#1e3a8a'}
                strokeWidth={thickness}
                pathLength="100"
                strokeDasharray={`${s.pct} ${100 - s.pct}`}
                strokeDashoffset={s.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{
                  transition: 'opacity 0.15s, stroke-width 0.15s',
                  opacity: hoverIdx === null || hoverIdx === s.idx ? 1 : 0.35,
                  strokeWidth: hoverIdx === s.idx ? thickness + 4 : thickness,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoverIdx(s.idx)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <title>{`${s.label}: ${s.value} (${s.pct.toFixed(1)}%)`}</title>
              </circle>
            ))}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {empty ? (
            <span className="text-xs text-outline">{emptyMessage}</span>
          ) : (
            <>
              <div className="text-2xl font-bold text-on-surface leading-none">
                {centerLabel ?? total}
              </div>
              {centerSubLabel ? (
                <div className="text-[11px] text-outline mt-1 uppercase tracking-wider">
                  {centerSubLabel}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <ul className="flex flex-col gap-1.5 min-w-[180px] flex-1">
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.value || 0) / total) * 100 : 0
          return (
            <li
              key={d.key}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className={`flex items-center gap-2 text-sm px-2 py-1 rounded transition-colors cursor-default ${
                hoverIdx === i ? 'bg-neutral-50' : ''
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: d.colorHex || '#1e3a8a' }}
              />
              <span className="flex-1 truncate text-on-surface">{d.label}</span>
              <span className="text-on-surface-variant tabular-nums">
                {d.value || 0}
                <span className="text-outline text-xs ml-1">
                  ({pct.toFixed(0)}%)
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
