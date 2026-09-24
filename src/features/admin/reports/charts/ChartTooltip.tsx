import type { ReactNode } from 'react'

type Entry = { name?: ReactNode; value?: unknown; color?: string; dataKey?: unknown }

type ChartTooltipProps = {
  active?: boolean
  label?: ReactNode
  payload?: readonly Entry[]
  labelFormatter?: (label: ReactNode) => ReactNode
  valueFormatter?: (value: number) => string
}

/** Tooltip box: bg-surface, border, shadow-overlay (docs/09 section 5). */
export function ChartTooltip({ active, label, payload, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="min-w-40 rounded-md border border-line bg-surface px-3 py-2 shadow-overlay">
      <p className="mb-1 text-caption text-muted">{labelFormatter ? labelFormatter(label) : label}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4 text-body-sm">
            <span className="flex items-center gap-2 text-ink">
              <span aria-hidden="true" className="size-2.5 rounded-xs" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-ink tabular-nums">
              {typeof p.value === 'number' ? (valueFormatter ? valueFormatter(p.value) : p.value) : String(p.value ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
