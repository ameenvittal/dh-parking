import type { Workbook } from 'exceljs'
import { mapColors } from '@/features/map/style/colors'
import { formatDateTime, formatPlate, isoDay } from '@/lib/format'
import type { VisitSummary } from '@/types/domain'
import { downloadBlob, fileSlug } from '../reports/download'
import type { Translate } from '../reports/reportBundle'

/** "Export" on the Vehicles page: one sheet with the rows of the current filter. */
export async function exportVisitList(rows: VisitSummary[], eventName: string, t: Translate): Promise<void> {
  const mod = await import('exceljs')
  const WorkbookCtor: typeof Workbook =
    (mod as { Workbook?: typeof Workbook }).Workbook ?? (mod as unknown as { default: { Workbook: typeof Workbook } }).default.Workbook
  const wb = new WorkbookCtor()
  const ws = wb.addWorksheet(t('admin.vehicles.title'))
  const cols = ['plate', 'type', 'category', 'slot', 'zone', 'status', 'phone', 'checkedIn', 'parked', 'left', 'gate', 'whatsapp'] as const
  ws.addRow(cols.map((c) => t(`admin.vehicles.columns.${c}`)))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${mapColors.surface2.slice(1)}` } }
  })
  for (const v of rows) {
    ws.addRow([
      formatPlate(v.plate),
      t(`common.enums.vehicleType.${v.vehicle_type}`),
      t(`common.enums.category.${v.category}`),
      v.slot_label ?? '',
      v.zone_code ?? '',
      t(`common.enums.visitStatus.${v.status}`),
      v.phone ?? v.phone_masked,
      formatDateTime(v.checked_in_at),
      v.confirmed_at ?? v.driver_parked_at ? formatDateTime((v.confirmed_at ?? v.driver_parked_at) as string) : '',
      v.exited_at ? formatDateTime(v.exited_at) : '',
      v.entry_gate_name ?? '',
      v.wa_status ? t(`admin.waStatus.${v.wa_status}`) : '',
    ])
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.columns.forEach((c) => {
    c.width = 18
  })
  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${fileSlug(eventName)}-vehicles-${isoDay(new Date())}.xlsx`,
  )
}
