import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

type ChartFrameProps = {
  /** Fixed size for offscreen rendering (PDF export). Omit to fill the parent. */
  width?: number
  height: number
  children: (size: { width?: number; height: number }) => ReactElement
}

/** Renders a recharts chart either responsive (on screen) or at a fixed size (PDF export). */
export function ChartFrame({ width, height, children }: ChartFrameProps) {
  if (width) return children({ width, height })
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children({ height })}
    </ResponsiveContainer>
  )
}
