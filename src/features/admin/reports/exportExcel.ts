import { getTimezoneOffset } from 'date-fns-tz'
import type { Workbook, Worksheet } from 'exceljs'
import { APP_TIMEZONE } from '@/config/app'
import { mapColors } from '@/features/map/style/colors'
import { formatDuration, formatPlate, isoDay } from '@/lib/format'
import { VEHICLE_TYPES } from '@/types/domain'
import { occupancyStats, windowLabel } from './reportMath'
import type { ReportBundle, Translate } from './reportBundle'
import { downloadBlob, fileSlug } from './download'

/** docs/09 section 6: one sheet per report plus raw Vehicles and Alerts sheets. */

const DATE_FMT = 'dd mmm yyyy h:mm AM/PM'

/** Excel has no time zone: shift so the stored wall clock is India time. */
function excelDate(iso: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return new Date(d.getTime() + getTimezoneOffset(APP_TIMEZONE, d))
}

function argb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}

function styleHeader(ws: Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber)
  row.font = { bold: true }
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(mapColors.surface2) } }
  })
}

function autoWidth(ws: Worksheet) {
  ws.columns.forEach((col) => {
    let max = 8
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value
      const len = v instanceof Date ? 20 : String(v ?? '').length
      if (len > max) max = len
    })
    col.width = Math.min(40, max + 2)
  })
}

function freezeTop(ws: Worksheet) {
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

/** Adds a header row plus rows, returns the next free row number. */
function addTable(ws: Worksheet, startRow: number, header: string[], rows: (string | number | Date | null)[][]): number {
  ws.getRow(startRow).values = header
  styleHeader(ws, startRow)
  rows.forEach((r, i) => {
    ws.getRow(startRow + 1 + i).values = r
  })
  return startRow + rows.length + 2
}

function dateCols(ws: Worksheet, cols: number[], fmt = DATE_FMT) {
  for (const c of cols) ws.getColumn(c).numFmt = fmt
}

export async function exportExcel(bundle: ReportBundle, t: Translate): Promise<void> {
  const mod = await import('exceljs')
  const WorkbookCtor: typeof Workbook =
    (mod as { Workbook?: typeof Workbook }).Workbook ?? (mod as unknown as { default: { Workbook: typeof Workbook } }).default.Workbook
  const wb = new WorkbookCtor()
  wb.creator = 'EventPark'
  wb.created = new Date()

  const { event, occupancy, peak, revenue, counts } = bundle
  const stats = occupancyStats(occupancy, event)
  const peakZone = stats.reduce<(typeof stats)[number] | null>((a, b) => (!a || b.peak_pct > a.peak_pct ? b : a), null)

  /* Summary */
  const summary = wb.addWorksheet(t('reports.excel.summary'))
  summary.getRow(1).values = [t('reports.excel.field'), t('reports.excel.value')]
  styleHeader(summary, 1)
  const summaryRows: [string, string | number | Date | null][] = [
    [t('reports.excel.event'), event.name],
    [t('reports.excel.starts'), excelDate(event.starts_at)],
    [t('reports.excel.ends'), excelDate(event.ends_at)],
    [t('reports.excel.generated'), excelDate(new Date().toISOString())],
    [t('reports.excel.rangeFrom'), excelDate(bundle.filters.from)],
    [t('reports.excel.rangeTo'), excelDate(bundle.filters.to)],
    [t('reports.excel.zones'), bundle.filters.zoneLabel],
    [t('reports.excel.interval'), t('reports.filters.intervalOption', { count: bundle.filters.intervalMin })],
    [t('reports.excel.totalVehicles'), counts.total],
    [t('reports.excel.peakOccupancy'), peakZone ? `${peakZone.peak_pct}% (${peakZone.code})` : null],
    [
      t('reports.excel.busiestArrival'),
      peak.busiest_arrival ? t('reports.peak.busiestValue', { window: windowLabel(peak.busiest_arrival.t, peak.interval_min, t), count: peak.busiest_arrival.count }) : null,
    ],
    [t('reports.excel.revenueTotal'), revenue.total],
  ]
  summaryRows.forEach(([k, v], i) => {
    const row = summary.getRow(i + 2)
    row.values = [k, v]
    if (v instanceof Date) row.getCell(2).numFmt = DATE_FMT
  })
  summary.getCell(`B${summaryRows.length + 1}`).numFmt = '#,##0'
  freezeTop(summary)
  autoWidth(summary)

  /* Occupancy */
  const occ = wb.addWorksheet(t('reports.tabs.occupancy'))
  const zoneHeaders = occupancy.zones.map((z) => `${z.code} ${z.name} (%)`)
  let next = addTable(
    occ,
    1,
    [t('reports.table.time'), ...zoneHeaders, `${t('reports.occupancy.total')} (%)`],
    occupancy.series.map((s) => [
      excelDate(s.t),
      ...occupancy.zones.map((z) => s.values[z.zone_id]?.pct ?? 0),
      s.total.pct,
    ]),
  )
  occ.getRow(next - 1).values = [t('reports.excel.parkedCounts')]
  occ.getRow(next - 1).font = { bold: true }
  next = addTable(
    occ,
    next,
    [t('reports.table.time'), ...occupancy.zones.map((z) => `${z.code} ${z.name}`), t('reports.occupancy.total')],
    occupancy.series.map((s) => [
      excelDate(s.t),
      ...occupancy.zones.map((z) => s.values[z.zone_id]?.parked ?? 0),
      s.total.parked,
    ]),
  )
  addTable(
    occ,
    next,
    [
      t('reports.occupancy.zone'),
      t('reports.occupancy.capacity'),
      t('reports.occupancy.peakPct'),
      t('reports.occupancy.peakTime'),
      t('reports.occupancy.avgPct'),
      t('reports.occupancy.above90'),
    ],
    stats.map((s) => [
      `${s.code} ${s.name}`,
      s.capacity,
      s.peak_pct,
      excelDate(s.peak_at),
      s.avg_pct,
      formatDuration(s.minutes_above_90),
    ]),
  )
  dateCols(occ, [1])
  occ.getColumn(4).numFmt = DATE_FMT
  freezeTop(occ)
  autoWidth(occ)

  /* Peak hours */
  const ph = wb.addWorksheet(t('reports.tabs.peak'))
  addTable(
    ph,
    1,
    [
      t('reports.table.timeWindow'),
      t('reports.peak.arrivals'),
      t('reports.peak.exits'),
      ...peak.by_gate.flatMap((g) => [
        t('reports.peak.gateArrivals', { gate: g.name }),
        t('reports.peak.gateExits', { gate: g.name }),
      ]),
    ],
    peak.series.map((s, i) => [
      excelDate(s.t),
      s.arrivals,
      s.exits,
      ...peak.by_gate.flatMap((g) => [g.arrivals[i] ?? 0, g.exits[i] ?? 0]),
    ]),
  )
  dateCols(ph, [1])
  freezeTop(ph)
  autoWidth(ph)

  /* Revenue */
  const rev = wb.addWorksheet(t('reports.tabs.revenue'))
  next = addTable(
    rev,
    1,
    [t('reports.occupancy.zone'), t('reports.revenue.amount'), t('reports.revenue.vehicles')],
    revenue.by_zone.map((z) => [`${z.code} ${z.name}`, z.amount, z.count]),
  )
  next = addTable(
    rev,
    next,
    [t('reports.revenue.day'), t('reports.revenue.amount'), t('reports.revenue.vehicles')],
    revenue.by_day.map((d) => [d.date, d.amount, d.count]),
  )
  addTable(
    rev,
    next,
    [t('reports.revenue.method'), t('reports.revenue.amount'), t('reports.revenue.vehicles')],
    revenue.by_method.map((m) => [t(`admin.paymentMethod.${m.method}`), m.amount, m.count]),
  )
  rev.getColumn(2).numFmt = '#,##0'
  freezeTop(rev)
  autoWidth(rev)

  /* Vehicle counts */
  const vc = wb.addWorksheet(t('reports.tabs.counts'))
  next = addTable(
    vc,
    1,
    [
      t('reports.counts.category'),
      ...VEHICLE_TYPES.map((ty) => t(`common.enums.vehicleType.${ty}`)),
      t('reports.counts.total'),
    ],
    [
      ...counts.matrix.map((m) => [
        t(`common.enums.category.${m.category}`),
        ...VEHICLE_TYPES.map((ty) => m[ty]),
        m.total,
      ]),
      [
        t('reports.counts.total'),
        ...VEHICLE_TYPES.map((ty) => counts.matrix.reduce((a, m) => a + m[ty], 0)),
        counts.total,
      ],
    ],
  )
  addTable(
    vc,
    next,
    [t('reports.occupancy.zone'), t('reports.revenue.vehicles')],
    counts.by_zone.map((z) => [`${z.code} ${z.name}`, z.count]),
  )
  freezeTop(vc)
  autoWidth(vc)

  /* Vehicles (raw) */
  const vs = wb.addWorksheet(t('reports.excel.vehicles'))
  addTable(
    vs,
    1,
    [
      t('reports.raw.plate'),
      t('reports.raw.vehicleType'),
      t('reports.raw.colour'),
      t('reports.raw.make'),
      t('reports.raw.category'),
      t('reports.raw.passNumber'),
      t('reports.raw.passHolder'),
      t('reports.raw.accessible'),
      t('reports.raw.phone'),
      t('reports.raw.driverName'),
      t('reports.raw.entryGate'),
      t('reports.raw.checkedIn'),
      t('reports.raw.slot'),
      t('reports.raw.zone'),
      t('reports.raw.status'),
      t('reports.raw.linkOpened'),
      t('reports.raw.driverParked'),
      t('reports.raw.parkedDistance'),
      t('reports.raw.confirmed'),
      t('reports.raw.confirmedBy'),
      t('reports.raw.exited'),
      t('reports.raw.exitGate'),
      t('reports.raw.fee'),
      t('reports.raw.paymentMethod'),
      t('reports.raw.aiConfidence'),
      t('reports.raw.aiEdited'),
      t('reports.raw.whatsapp'),
    ],
    bundle.visits.map((v) => [
      formatPlate(v.plate),
      t(`common.enums.vehicleType.${v.vehicle_type}`),
      v.vehicle_color,
      v.vehicle_make,
      t(`common.enums.category.${v.category}`),
      v.pass_number,
      v.pass_holder_name,
      v.needs_accessible ? t('admin.shared.yes') : t('admin.shared.no'),
      v.phone,
      v.driver_name,
      v.entry_gate,
      excelDate(v.checked_in_at),
      v.slot,
      v.zone,
      t(`common.enums.visitStatus.${v.status}`),
      excelDate(v.link_opened_at),
      excelDate(v.driver_parked_at),
      v.driver_parked_distance_m === null ? null : Math.round(v.driver_parked_distance_m),
      excelDate(v.confirmed_at),
      v.confirmed_by,
      excelDate(v.exited_at),
      v.exit_gate,
      v.fee_amount,
      t(`admin.paymentMethod.${v.payment_method}`),
      v.ai_plate_confidence,
      v.ai_edited ? t('admin.shared.yes') : t('admin.shared.no'),
      v.wa_status ? t(`admin.waStatus.${v.wa_status}`) : null,
    ]),
  )
  dateCols(vs, [12, 16, 17, 19, 21])
  freezeTop(vs)
  autoWidth(vs)

  /* Alerts */
  const al = wb.addWorksheet(t('reports.excel.alerts'))
  addTable(
    al,
    1,
    [
      t('reports.raw.alertType'),
      t('reports.raw.status'),
      t('reports.raw.plate'),
      t('reports.raw.zone'),
      t('reports.raw.raisedBy'),
      t('reports.raw.created'),
      t('reports.raw.resolved'),
      t('reports.raw.note'),
    ],
    bundle.alerts.map((a) => [
      t(`admin.alertType.${a.type}`),
      t(`admin.alertStatus.${a.status}`),
      a.plate ? formatPlate(a.plate) : null,
      a.zone,
      a.raised_by,
      excelDate(a.created_at),
      excelDate(a.resolved_at),
      a.note,
    ]),
  )
  dateCols(al, [6, 7])
  freezeTop(al)
  autoWidth(al)

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `${fileSlug(event.name)}-parking-${isoDay(new Date())}.xlsx`)
}
