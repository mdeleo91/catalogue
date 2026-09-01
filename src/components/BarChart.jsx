import { useState } from 'react'

// Horizontal bar list for magnitude-by-category. One hue (the data isn't
// encoding identity by color), thin 8px marks with rounded data-ends, direct
// value labels in ink, per-row hover/tap highlight as the interaction layer.
export function BarChart({ rows, format = (v) => v.toLocaleString() }) {
  const [active, setActive] = useState(null)
  if (!rows.length) return <div className="text-sm text-ink-3">No data yet.</div>
  const max = Math.max(...rows.map(([, v]) => v))
  return (
    <div className="space-y-2" onMouseLeave={() => setActive(null)}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={`grid grid-cols-[7rem_1fr_auto] items-center gap-2 rounded px-1 py-0.5 ${
            active === label ? 'bg-surface' : ''
          }`}
          onMouseEnter={() => setActive(label)}
          onClick={() => setActive(active === label ? null : label)}
          title={`${label}: ${format(value)}`}
        >
          <span className="truncate text-xs text-ink-2">{label}</span>
          <span className="relative h-2 overflow-hidden rounded-full bg-surface">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
            />
          </span>
          <span className="text-xs font-semibold tabular-nums text-ink">{format(value)}</span>
        </div>
      ))}
    </div>
  )
}
