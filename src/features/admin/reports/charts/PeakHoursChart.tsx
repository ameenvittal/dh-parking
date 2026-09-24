import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { mapColors } from '@/features/map/style/colors'
import type { PeakHoursReport } from '@/lib/demo/types'
import { formatClock } from '@/lib/format'
import { ChartFrame } from './ChartFrame'
import { ChartTooltip } from './ChartTooltip'
import { axisLine, axisTick, gridStroke, legendStyle } from './chartTheme'

type PeakHoursChartProps = {
  data: PeakHoursReport
  arrivalsLabel: string
  exitsLabel: string
  width?: number
  height?: number
}

/** Grouped bars: arrivals primary, exits status-occupied (docs/09 section 2). */
export function PeakHoursChart({ data, arrivalsLabel, exitsLabel, width, height = 360 }: PeakHoursChartProps) {
  const animate = !width
  return (
    <ChartFrame width={width} height={height}>
      {(size) => (
        <BarChart data={data.series} {...size} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(v: string) => formatClock(v)}
            tick={axisTick}
            axisLine={axisLine}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: mapColors.surface2 }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                label={p.label as string}
                payload={p.payload}
                labelFormatter={(l) => (typeof l === 'string' ? formatClock(l) : l)}
              />
            )}
          />
          {animate ? <Legend verticalAlign="bottom" iconType="square" wrapperStyle={legendStyle} /> : null}
          <Bar dataKey="arrivals" name={arrivalsLabel} fill={mapColors.primary} radius={[2, 2, 0, 0]} isAnimationActive={animate} />
          <Bar dataKey="exits" name={exitsLabel} fill={mapColors.statusOccupied} radius={[2, 2, 0, 0]} isAnimationActive={animate} />
        </BarChart>
      )}
    </ChartFrame>
  )
}
