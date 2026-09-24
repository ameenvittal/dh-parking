import type { jsPDF as JsPdf } from 'jspdf'
import { createElement, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { mapColors, zoneColor } from '@/features/map/style/colors'
import { i18n } from '@/lib/i18n'
import { formatDateTime, formatDuration, formatNumber, isoDay } from '@/lib/format'
import { VEHICLE_TYPES } from '@/types/domain'
import { HorizontalBarChart } from './charts/HorizontalBarChart'
import { OccupancyChart } from './charts/OccupancyChart'
import { PeakHoursChart } from './charts/PeakHoursChart'
import { downloadBlob, fileSlug } from './download'
import type { ReportBundle, Translate } from './reportBundle'
import { occupancyStats, windowLabel } from './reportMath'

/**
 * docs/09 section 6: A4 portrait, English only, built-in Helvetica. Charts are rendered
 * offscreen, serialised to SVG, drawn on a canvas at 2x and added as PNG.
 */

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2
const CHART_PX_W = 720
const CHART_PX_H = 320

type RGB = [number, number, number]

function rgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function chartToPng(element: ReactElement, width: number, height: number): Promise<string | null> {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(element)
    await nextFrame()
    await nextFrame()
    await new Promise((r) => setTimeout(r, 50))
    const svg = host.querySelector('svg.recharts-surface') ?? host.querySelector('svg')
    if (!svg) return null
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    clone.setAttribute('style', 'font-family: Helvetica, Arial, sans-serif; background: white')
    const data = new XMLSerializer().serializeToString(clone)
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = mapColors.white
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(2, 2)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    root.unmount()
    host.remove()
  }
}

type Cursor = { y: number }

export async function exportPdf(bundle: ReportBundle): Promise<void> {
  await i18n.loadLanguages('en')
  await i18n.loadNamespaces(['admin', 'reports', 'common'])
  const t: Translate = i18n.getFixedT('en')

  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc: JsPdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const { event, occupancy, peak, counts } = bundle
  const ink = rgb(mapColors.ink)
  const muted = rgb(mapColors.muted)
  const headFill = rgb(mapColors.surface2)
  const lineColor = rgb(mapColors.line)

  const tableStyles = {
    theme: 'grid' as const,
    styles: { font: 'helvetica', fontSize: 9, textColor: ink, lineColor, lineWidth: 0.1, cellPadding: 1.8 },
    headStyles: { fillColor: headFill, textColor: ink, fontStyle: 'bold' as const },
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
  }

  const lastY = (): number => {
    const d = doc as JsPdf & { lastAutoTable?: { finalY?: number } }
    return d.lastAutoTable?.finalY ?? MARGIN
  }

  const ensureSpace = (cur: Cursor, needed: number) => {
    if (cur.y + needed > PAGE_H - 20) {
      doc.addPage()
      cur.y = MARGIN
    }
  }

  const heading = (cur: Cursor, text: string) => {
    ensureSpace(cur, 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...ink)
    doc.text(text, MARGIN, cur.y + 5)
    cur.y += 10
  }

  const subheading = (cur: Cursor, text: string) => {
    ensureSpace(cur, 10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...ink)
    doc.text(text, MARGIN, cur.y + 4)
    cur.y += 7
  }

  const table = (cur: Cursor, head: string[], body: (string | number)[][]) => {
    autoTable(doc, { ...tableStyles, startY: cur.y, head: [head], body })
    cur.y = lastY() + 6
  }

  const chart = async (cur: Cursor, element: ReactElement, legend?: { label: string; color: string; dashed?: boolean }[]) => {
    const png = await chartToPng(element, CHART_PX_W, CHART_PX_H)
    if (!png) return
    const h = (CONTENT_W * CHART_PX_H) / CHART_PX_W
    ensureSpace(cur, h + (legend ? 10 : 4))
    doc.addImage(png, 'PNG', MARGIN, cur.y, CONTENT_W, h)
    cur.y += h + 2
    if (legend && legend.length > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      let x = MARGIN
      for (const item of legend) {
        const w = doc.getTextWidth(item.label) + 9
        if (x + w > PAGE_W - MARGIN) {
          x = MARGIN
          cur.y += 5
        }
        doc.setDrawColor(...rgb(item.color))
        doc.setLineWidth(0.8)
        if (item.dashed) doc.setLineDashPattern([1.2, 0.8], 0)
        doc.line(x, cur.y + 2, x + 5, cur.y + 2)
        doc.setLineDashPattern([], 0)
        doc.setTextColor(...muted)
        doc.text(item.label, x + 6.5, cur.y + 3)
        x += w + 4
      }
      cur.y += 8
    }
  }

  /* Page 1: title and summary */
  const cur: Cursor = { y: MARGIN }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...ink)
  doc.text(t('reports.pdf.title'), MARGIN, cur.y + 8)
  cur.y += 16
  doc.setFontSize(12)
  doc.text(event.name, MARGIN, cur.y)
  cur.y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(
    t('reports.pdf.dates', { from: formatDateTime(event.starts_at), to: formatDateTime(event.ends_at) }),
    MARGIN,
    cur.y,
  )
  cur.y += 5
  doc.text(t('reports.pdf.generated', { time: formatDateTime(new Date()) }), MARGIN, cur.y)
  cur.y += 5
  doc.text(
    t('reports.pdf.range', { from: formatDateTime(bundle.filters.from), to: formatDateTime(bundle.filters.to) }),
    MARGIN,
    cur.y,
  )
  cur.y += 8

  const stats = occupancyStats(occupancy, event)
  const peakZone = stats.reduce<(typeof stats)[number] | null>((a, b) => (!a || b.peak_pct > a.peak_pct ? b : a), null)
  table(
    cur,
    [t('reports.excel.field'), t('reports.excel.value')],
    [
      [t('reports.excel.zones'), bundle.filters.zoneLabel],
      [t('reports.excel.totalVehicles'), formatNumber(counts.total)],
      [t('reports.excel.peakOccupancy'), peakZone ? `${peakZone.peak_pct}% (${peakZone.code}, ${peakZone.peak_at ? formatDateTime(peakZone.peak_at) : ''})` : '-'],
      [
        t('reports.excel.busiestArrival'),
        peak.busiest_arrival
          ? t('reports.peak.busiestValue', { window: windowLabel(peak.busiest_arrival.t, peak.interval_min, t), count: peak.busiest_arrival.count })
          : '-',
      ],
      [
        t('reports.peak.busiestExit'),
        peak.busiest_exit
          ? t('reports.peak.busiestValue', { window: windowLabel(peak.busiest_exit.t, peak.interval_min, t), count: peak.busiest_exit.count })
          : '-',
      ],
    ],
  )

  /* Occupancy */
  doc.addPage()
  cur.y = MARGIN
  heading(cur, t('reports.tabs.occupancy'))
  await chart(
    cur,
    createElement(OccupancyChart, {
      data: occupancy,
      showCounts: false,
      totalLabel: t('reports.occupancy.total'),
      width: CHART_PX_W,
      height: CHART_PX_H,
    }),
    [
      ...occupancy.zones.map((z) => ({ label: `${z.code} ${z.name}`, color: zoneColor(z.color) })),
      { label: t('reports.occupancy.total'), color: mapColors.ink, dashed: true },
    ],
  )
  table(
    cur,
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
      `${s.peak_pct}%`,
      s.peak_at ? formatDateTime(s.peak_at) : '-',
      `${s.avg_pct}%`,
      formatDuration(s.minutes_above_90),
    ]),
  )

  /* Peak hours */
  heading(cur, t('reports.tabs.peak'))
  await chart(
    cur,
    createElement(PeakHoursChart, {
      data: peak,
      arrivalsLabel: t('reports.peak.arrivals'),
      exitsLabel: t('reports.peak.exits'),
      width: CHART_PX_W,
      height: CHART_PX_H,
    }),
    [
      { label: t('reports.peak.arrivals'), color: mapColors.primary },
      { label: t('reports.peak.exits'), color: mapColors.statusOccupied },
    ],
  )
  table(
    cur,
    [
      t('reports.table.timeWindow'),
      t('reports.peak.arrivals'),
      t('reports.peak.exits'),
      ...peak.by_gate.flatMap((g) => [
        t('reports.peak.gateArrivals', { gate: g.name }),
        t('reports.peak.gateExits', { gate: g.name }),
      ]),
    ],
    peak.series
      .map((s, i) => [
        windowLabel(s.t, peak.interval_min, t),
        s.arrivals,
        s.exits,
        ...peak.by_gate.flatMap((g) => [g.arrivals[i] ?? 0, g.exits[i] ?? 0]),
      ])
      .filter((r) => (r[1] as number) > 0 || (r[2] as number) > 0),
  )

  /* Vehicle counts */
  heading(cur, t('reports.tabs.counts'))
  subheading(cur, t('reports.counts.byCategory'))
  await chart(
    cur,
    createElement(HorizontalBarChart, {
      rows: counts.by_category.map((c) => ({ label: t(`common.enums.category.${c.category}`), count: c.count })),
      valueLabel: t('reports.revenue.vehicles'),
      width: CHART_PX_W,
      height: CHART_PX_H,
    }),
  )
  subheading(cur, t('reports.counts.byType'))
  await chart(
    cur,
    createElement(HorizontalBarChart, {
      rows: counts.by_type.map((c) => ({ label: t(`common.enums.vehicleType.${c.type}`), count: c.count })),
      valueLabel: t('reports.revenue.vehicles'),
      width: CHART_PX_W,
      height: CHART_PX_H,
    }),
  )
  table(
    cur,
    [t('reports.counts.category'), ...VEHICLE_TYPES.map((ty) => t(`common.enums.vehicleType.${ty}`)), t('reports.counts.total')],
    [
      ...counts.matrix.map((m) => [t(`common.enums.category.${m.category}`), ...VEHICLE_TYPES.map((ty) => m[ty]), m.total]),
      [t('reports.counts.total'), ...VEHICLE_TYPES.map((ty) => counts.matrix.reduce((a, m) => a + m[ty], 0)), counts.total],
    ],
  )
  subheading(cur, t('reports.counts.quality'))
  table(
    cur,
    [t('reports.excel.field'), t('reports.excel.value')],
    [
      [t('reports.counts.aiAccuracy'), counts.ai.accuracy_pct === null ? '-' : `${counts.ai.accuracy_pct}%`],
      [t('reports.counts.aiEdited'), `${counts.ai.plate_edited} / ${counts.ai.photos}`],
      [t('reports.counts.waFailed'), `${counts.whatsapp.failed} / ${counts.whatsapp.sent + counts.whatsapp.failed}`],
      [t('reports.counts.wrongSlots'), counts.confirmation.wrong_slot],
      [t('reports.counts.locationMismatch'), counts.confirmation.location_mismatch],
      [t('reports.counts.accessible'), counts.accessible],
    ],
  )

  /* Footer on every page */
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(t('reports.pdf.page', { n: i, m: pages }), PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' })
    doc.text(event.name, MARGIN, PAGE_H - 8)
  }

  const blob = doc.output('blob')
  downloadBlob(blob, `${fileSlug(event.name)}-parking-${isoDay(new Date())}.pdf`)
}

