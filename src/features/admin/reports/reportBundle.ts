import type {
  ExportAlertRow,
  ExportVisitRow,
  OccupancyReport,
  PeakHoursReport,
  ReportInterval,
  VehicleCountsReport,
} from '@/lib/demo/types'
import type { EventRow } from '@/types/domain'

export type Translate = (key: string, options?: Record<string, unknown>) => string

/** Everything an export needs, fetched once with the page filters. */
export type ReportBundle = {
  event: EventRow
  filters: { from: string; to: string; zoneLabel: string; intervalMin: ReportInterval }
  occupancy: OccupancyReport
  peak: PeakHoursReport
  counts: VehicleCountsReport
  visits: ExportVisitRow[]
  alerts: ExportAlertRow[]
}
