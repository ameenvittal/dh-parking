import { mapColors } from '@/features/map/style/colors'

/** Shared recharts styling (docs/09 section 5): grid `line`, axis text caption muted. */
export const axisTick = { fontSize: 12, fontWeight: 600, fill: mapColors.muted } as const
export const gridStroke = mapColors.line
export const axisLine = { stroke: mapColors.line } as const
export const legendStyle = { fontSize: 12, fontWeight: 600, color: mapColors.muted, paddingTop: 8 } as const
