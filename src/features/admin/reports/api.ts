import { call } from '@/lib/demo/client'
import * as reports from '@/lib/demo/reports'
import type {
  ExportAlertRow,
  ExportVisitRow,
  OccupancyReport,
  PeakHoursReport,
  ReportFilters,
  ReportInterval,
  ReportZoneInfo,
  RevenueReport,
  VehicleCountsReport,
} from '@/lib/demo/types'

export type {
  ExportAlertRow,
  ExportVisitRow,
  OccupancyReport,
  PeakHoursReport,
  ReportFilters,
  ReportInterval,
  ReportZoneInfo,
  RevenueReport,
  VehicleCountsReport,
}

/*
 * Report RPCs from docs/09. `from` and `to` default to event start minus 3 h
 * and the earlier of now and event end plus 6 h. Buckets are in Asia/Kolkata.
 */

export function reportOccupancy(filters: ReportFilters): Promise<OccupancyReport> {
  return call(() => reports.reportOccupancy(filters))
}

export function reportPeakHours(filters: ReportFilters): Promise<PeakHoursReport> {
  return call(() => reports.reportPeakHours(filters))
}

export function reportRevenue(filters: ReportFilters): Promise<RevenueReport> {
  return call(() => reports.reportRevenue(filters))
}

export function reportVehicleCounts(filters: ReportFilters): Promise<VehicleCountsReport> {
  return call(() => reports.reportVehicleCounts(filters))
}

/** export_visits: raw rows for the Excel "Vehicles" sheet. */
export function exportVisits(filters: ReportFilters): Promise<ExportVisitRow[]> {
  return call(() => reports.exportVisits(filters))
}

/** Rows for the Excel "Alerts" sheet. */
export function exportAlerts(filters: ReportFilters): Promise<ExportAlertRow[]> {
  return call(() => reports.exportAlerts(filters))
}
