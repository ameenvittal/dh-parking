import type { OccupancyReport, PeakHoursReport } from '@/lib/demo/types'
import { formatClock } from '@/lib/format'

export type OccupancyZoneStat = {
  zone_id: string
  code: string
  name: string
  color: string
  capacity: number
  peak_pct: number
  peak_at: string | null
  avg_pct: number
  minutes_above_90: number
}

/**
 * Table under the occupancy chart (docs/09 section 1): peak %, peak time, average % during
 * event hours, time above 90% (buckets with pct >= 90 times the interval).
 */
export function occupancyStats(
  report: OccupancyReport,
  eventHours: { starts_at: string; ends_at: string } | null,
): OccupancyZoneStat[] {
  const start = eventHours ? new Date(eventHours.starts_at).getTime() : Number.NEGATIVE_INFINITY
  const end = eventHours ? new Date(eventHours.ends_at).getTime() : Number.POSITIVE_INFINITY
  return report.zones.map((z) => {
    let peak = 0
    let peakAt: string | null = null
    let sum = 0
    let n = 0
    let above = 0
    for (const s of report.series) {
      const pct = s.values[z.zone_id]?.pct ?? 0
      if (pct > peak) {
        peak = pct
        peakAt = s.t
      }
      if (pct >= 90) above += 1
      const tm = new Date(s.t).getTime()
      if (tm >= start && tm <= end) {
        sum += pct
        n += 1
      }
    }
    return {
      zone_id: z.zone_id,
      code: z.code,
      name: z.name,
      color: z.color,
      capacity: z.capacity,
      peak_pct: peak,
      peak_at: peakAt,
      avg_pct: n > 0 ? Math.round((sum / n) * 10) / 10 : 0,
      minutes_above_90: above * report.interval_min,
    }
  })
}

/** End of a bucket that starts at `t`. */
export function bucketEnd(t: string, intervalMin: number): string {
  return new Date(new Date(t).getTime() + intervalMin * 60_000).toISOString()
}

export function hasOccupancyData(r: OccupancyReport): boolean {
  return r.series.some((s) => s.total.holding > 0 || s.total.parked > 0)
}

export function hasPeakData(r: PeakHoursReport): boolean {
  return r.series.some((s) => s.arrivals > 0 || s.exits > 0)
}

/** Default report range (docs/09): event start minus 3 h to the earlier of now and event end plus 6 h. */
export function defaultRange(event: { starts_at: string; ends_at: string }): { from: string; to: string } {
  const from = new Date(new Date(event.starts_at).getTime() - 3 * 3_600_000)
  const endPlus = new Date(event.ends_at).getTime() + 6 * 3_600_000
  const to = new Date(Math.min(Date.now(), endPlus))
  return { from: from.toISOString(), to: (to < from ? new Date(endPlus) : to).toISOString() }
}

/** "10:15 to 10:30 am" style label for a bucket. */
export function windowLabel(t: string, intervalMin: number, tr: (key: string, o?: Record<string, unknown>) => string): string {
  return tr('reports.peak.window', { from: formatClock(t), to: formatClock(bucketEnd(t, intervalMin)) })
}
