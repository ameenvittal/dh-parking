import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { mapColors, zoneColor } from '@/features/map/style/colors'
import type { OccupancyReport } from '@/lib/demo/types'
import { formatClock } from '@/lib/format'
import { ChartFrame } from './ChartFrame'
import { ChartTooltip } from './ChartTooltip'
import { axisLine, axisTick, gridStroke, legendStyle } from './chartTheme'

type OccupancyChartProps = {
  data: OccupancyReport
  showCounts: boolean
  totalLabel: string
  width?: number
  height?: number
}

/** Line per zone in zone colour, total dashed in ink (docs/09 section 1). */
export function OccupancyChart({ data, showCounts, totalLabel, width, height = 360 }: OccupancyChartProps) {
  const rows = data.series.map((s) => {
    const row: Record<string, number | string> = { t: s.t, total: showCounts ? s.total.parked : s.total.pct }
    for (const z of data.zones) {
      const v = s.values[z.zone_id]
      row[z.zone_id] = v ? (showCounts ? v.parked : v.pct) : 0
    }
    return row
  })
  const animate = !width
  return (
    <ChartFrame width={width} height={height}>
      {(size) => (
        <LineChart data={rows} {...size} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(v: string) => formatClock(v)}
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={showCounts ? [0, 'auto'] : [0, 100]}
            tickFormatter={(v: number) => (showCounts ? String(v) : `${v}%`)}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            content={(p) => (
              <ChartTooltip
                active={p.active}
                label={p.label as string}
                payload={p.payload}
                labelFormatter={(l) => (typeof l === 'string' ? formatClock(l) : l)}
                valueFormatter={(v) => (showCounts ? String(v) : `${v}%`)}
              />
            )}
          />
          {animate ? <Legend verticalAlign="bottom" iconType="plainline" wrapperStyle={legendStyle} /> : null}
          {data.zones.map((z) => (
            <Line
              key={z.zone_id}
              type="monotone"
              dataKey={z.zone_id}
              name={`${z.code} ${z.name}`}
              stroke={zoneColor(z.color)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={animate}
            />
          ))}
          <Line
            type="monotone"
            dataKey="total"
            name={totalLabel}
            stroke={mapColors.ink}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={animate}
          />
        </LineChart>
      )}
    </ChartFrame>
  )
}
