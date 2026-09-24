import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { mapColors } from '@/features/map/style/colors'
import type { RevenueReport } from '@/lib/demo/types'
import { formatInr } from '@/lib/format'
import { ChartFrame } from './ChartFrame'
import { ChartTooltip } from './ChartTooltip'
import { axisLine, axisTick, gridStroke } from './chartTheme'

type RevenueChartProps = { data: RevenueReport; amountLabel: string; width?: number; height?: number }

/** Revenue by zone (docs/09 section 3). */
export function RevenueChart({ data, amountLabel, width, height = 360 }: RevenueChartProps) {
  const rows = data.by_zone.map((z) => ({ zone: `${z.code} ${z.name}`, amount: z.amount }))
  const animate = !width
  return (
    <ChartFrame width={width} height={height}>
      {(size) => (
        <BarChart data={rows} {...size} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={gridStroke} vertical={false} />
          <XAxis dataKey="zone" tick={axisTick} axisLine={axisLine} tickLine={false} interval={0} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v: number) => formatInr(v)}
          />
          <Tooltip
            cursor={{ fill: mapColors.surface2 }}
            content={(p) => (
              <ChartTooltip active={p.active} label={p.label as string} payload={p.payload} valueFormatter={formatInr} />
            )}
          />
          <Bar dataKey="amount" name={amountLabel} fill={mapColors.primary} radius={[2, 2, 0, 0]} isAnimationActive={animate} />
        </BarChart>
      )}
    </ChartFrame>
  )
}
