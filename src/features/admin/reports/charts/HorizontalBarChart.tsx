import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { mapColors } from '@/features/map/style/colors'
import { ChartFrame } from './ChartFrame'
import { ChartTooltip } from './ChartTooltip'
import { axisLine, axisTick, gridStroke } from './chartTheme'

type HorizontalBarChartProps = {
  rows: { label: string; count: number }[]
  valueLabel: string
  width?: number
  height?: number
}

/** Counts by category or by vehicle type (docs/09 section 4). */
export function HorizontalBarChart({ rows, valueLabel, width, height = 300 }: HorizontalBarChartProps) {
  const animate = !width
  return (
    <ChartFrame width={width} height={height}>
      {(size) => (
        <BarChart data={rows} layout="vertical" {...size} margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={gridStroke} horizontal={false} />
          <XAxis type="number" tick={axisTick} axisLine={axisLine} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tick={axisTick} axisLine={false} tickLine={false} width={96} />
          <Tooltip
            cursor={{ fill: mapColors.surface2 }}
            content={(p) => <ChartTooltip active={p.active} label={p.label as string} payload={p.payload} />}
          />
          <Bar dataKey="count" name={valueLabel} fill={mapColors.primary} radius={[0, 2, 2, 0]} barSize={18} isAnimationActive={animate} />
        </BarChart>
      )}
    </ChartFrame>
  )
}
