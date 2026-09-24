import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiStrip } from '@/components/common/KpiStrip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useErrorText } from '@/hooks/useErrorText'
import { formatDateTime, formatDuration, formatInr, formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { VEHICLE_TYPES } from '@/types/domain'
import { formatInTimeZone } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/config/app'
import { ADMIN_BTN } from '../components/buttonSizes'
import { MultiFilter } from '../components/MultiFilter'
import { useAdminEvent } from '../layout/useAdminEvent'
import {
  exportAlerts,
  exportVisits,
  reportOccupancy,
  reportPeakHours,
  reportRevenue,
  reportVehicleCounts,
  type ReportFilters,
  type ReportInterval,
} from './api'
import { HorizontalBarChart } from './charts/HorizontalBarChart'
import { OccupancyChart } from './charts/OccupancyChart'
import { PeakHoursChart } from './charts/PeakHoursChart'
import { RevenueChart } from './charts/RevenueChart'
import { exportExcel } from './exportExcel'
import { exportPdf } from './exportPdf'
import type { ReportBundle } from './reportBundle'
import { defaultRange, hasOccupancyData, hasPeakData, occupancyStats, windowLabel } from './reportMath'

type Tab = 'occupancy' | 'peak' | 'revenue' | 'counts'
const TABS: Tab[] = ['occupancy', 'peak', 'revenue', 'counts']

/** `datetime-local` value in India time. */
function toLocalInput(iso: string): string {
  return formatInTimeZone(iso, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm")
}
function fromLocalInput(v: string): string {
  return new Date(`${v}:00+05:30`).toISOString()
}

/** Reports `/admin/reports` (docs/09, F-RPT-01 to 05). Filters live in the URL. */
export function ReportsPage() {
  const { t } = useTranslation(['admin', 'reports', 'common'])
  const errorText = useErrorText()
  const { events, event: selected, isLoading: eventsLoading } = useAdminEvent()
  const [params, setParams] = useSearchParams()

  const eventId = params.get('event') ?? selected?.id ?? null
  const event = events.find((e) => e.id === eventId) ?? selected ?? null
  // Stable default for display only; queries send null so the backend applies the same default.
  const range = useMemo(() => (event ? defaultRange(event) : null), [event])
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'occupancy') as Tab
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const from = fromParam ?? range?.from ?? ''
  const to = toParam ?? range?.to ?? ''
  const zoneIds = (params.get('zones') ?? '').split(',').filter(Boolean)
  const interval = (Number(params.get('interval')) || 15) as ReportInterval
  const [showCounts, setShowCounts] = useState(false)
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const filters: ReportFilters | null = event
    ? { eventId: event.id, from: fromParam, to: toParam, zoneIds: zoneIds.length ? zoneIds : null, intervalMin: interval }
    : null
  const enabled = Boolean(filters)
  const f = filters ?? { eventId: '' }
  const occupancy = useQuery({ queryKey: queryKeys.report('occupancy', f), queryFn: () => reportOccupancy(f), enabled })
  const peak = useQuery({ queryKey: queryKeys.report('peak', f), queryFn: () => reportPeakHours(f), enabled })
  const revenue = useQuery({ queryKey: queryKeys.report('revenue', f), queryFn: () => reportRevenue(f), enabled })
  const counts = useQuery({ queryKey: queryKeys.report('counts', f), queryFn: () => reportVehicleCounts(f), enabled })

  const zoneOptions = useMemo(() => (occupancy.data?.zones ?? []).map((z) => ({ value: z.zone_id, label: `${z.code} ${z.name}` })), [occupancy.data])
  const zoneLabel =
    zoneIds.length === 0
      ? t('reports.filters.allZones')
      : zoneOptions.filter((o) => zoneIds.includes(o.value)).map((o) => o.label).join(', ')

  const runExport = async (kind: 'xlsx' | 'pdf') => {
    if (!event || !filters || !occupancy.data || !peak.data || !revenue.data || !counts.data) return
    setBusy(kind)
    try {
      const [visits, alerts] = await Promise.all([exportVisits(filters), exportAlerts(filters)])
      const bundle: ReportBundle = {
        event,
        filters: { from, to, zoneLabel, intervalMin: interval },
        occupancy: occupancy.data,
        peak: peak.data,
        revenue: revenue.data,
        counts: counts.data,
        visits,
        alerts,
      }
      if (kind === 'xlsx') await exportExcel(bundle, t)
      else await exportPdf(bundle)
      toast.success(t('reports.exported'))
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  if (eventsLoading) return <Skeleton className="h-96 w-full rounded-lg" />
  if (!event) return <EmptyState title={t('admin.shared.noLiveEvent')} />

  const ready = occupancy.data && peak.data && revenue.data && counts.data
  const anyError = occupancy.error ?? peak.error ?? revenue.error ?? counts.error

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          size="md"
          className={ADMIN_BTN}
          icon={<FileSpreadsheet size={16} strokeWidth={1.75} aria-hidden="true" />}
          loading={busy === 'xlsx'}
          disabled={!ready || busy !== null}
          onClick={() => void runExport('xlsx')}
        >
          {t('reports.exportExcel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          className={ADMIN_BTN}
          icon={<FileText size={16} strokeWidth={1.75} aria-hidden="true" />}
          loading={busy === 'pdf'}
          disabled={!ready || busy !== null}
          onClick={() => void runExport('pdf')}
        >
          {t('reports.exportPdf')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface p-4 lg:flex lg:flex-wrap lg:items-end">
        <label className="col-span-2 flex flex-col gap-1.5 text-body-sm font-semibold text-ink lg:w-56">
          {t('reports.filters.event')}
          <Select
            value={event.id}
            onChange={(e) => set({ event: e.target.value, from: null, to: null, zones: null })}
            options={events.map((e) => ({ value: e.id, label: e.name }))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-body-sm font-semibold text-ink">
          {t('reports.filters.from')}
          <Input type="datetime-local" value={from ? toLocalInput(from) : ''} onChange={(e) => e.target.value && set({ from: fromLocalInput(e.target.value) })} />
        </label>
        <label className="flex flex-col gap-1.5 text-body-sm font-semibold text-ink">
          {t('reports.filters.to')}
          <Input type="datetime-local" value={to ? toLocalInput(to) : ''} onChange={(e) => e.target.value && set({ to: fromLocalInput(e.target.value) })} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm font-semibold text-ink">{t('reports.filters.zones')}</span>
          <MultiFilter
            label={zoneLabel.length > 24 ? t('reports.filters.zonesPicked', { count: zoneIds.length }) : zoneLabel}
            options={zoneOptions}
            value={zoneIds}
            onChange={(v) => set({ zones: v.join(',') })}
            clearLabel={t('admin.shared.clearFilters')}
            className="h-12 lg:h-10"
          />
        </div>
        <label className="flex flex-col gap-1.5 text-body-sm font-semibold text-ink lg:w-36">
          {t('reports.filters.interval')}
          <Select
            value={String(interval)}
            onChange={(e) => set({ interval: e.target.value })}
            options={[15, 30, 60].map((n) => ({ value: String(n), label: t('reports.filters.intervalOption', { count: n }) }))}
          />
        </label>
      </div>

      <Tabs value={tab} onValueChange={(v) => set({ tab: v })}>
        <TabsList>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`reports.tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {anyError ? (
        <ErrorState error={anyError} onRetry={() => [occupancy, peak, revenue, counts].forEach((q) => void q.refetch())} />
      ) : !ready ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-90 w-full rounded-lg" />
        </div>
      ) : tab === 'occupancy' ? (
        hasOccupancyData(occupancy.data) ? (
          <Panel
            kpis={null}
            chart={
              <>
                <SwitchRow label={t('reports.occupancy.showCounts')} checked={showCounts} onCheckedChange={setShowCounts} className="max-w-60" />
                <OccupancyChart data={occupancy.data} showCounts={showCounts} totalLabel={t('reports.occupancy.total')} />
              </>
            }
            table={
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.occupancy.zone')}</TableHead>
                    <TableHead numeric>{t('reports.occupancy.capacity')}</TableHead>
                    <TableHead numeric>{t('reports.occupancy.peakPct')}</TableHead>
                    <TableHead>{t('reports.occupancy.peakTime')}</TableHead>
                    <TableHead numeric>{t('reports.occupancy.avgPct')}</TableHead>
                    <TableHead numeric>{t('reports.occupancy.above90')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occupancyStats(occupancy.data, event).map((s) => (
                    <TableRow key={s.zone_id}>
                      <TableCell>{`${s.code} ${s.name}`}</TableCell>
                      <TableCell numeric>{s.capacity}</TableCell>
                      <TableCell numeric>{s.peak_pct}%</TableCell>
                      <TableCell>{s.peak_at ? formatDateTime(s.peak_at) : ''}</TableCell>
                      <TableCell numeric>{s.avg_pct}%</TableCell>
                      <TableCell numeric>{formatDuration(s.minutes_above_90)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
          />
        ) : (
          <NoData />
        )
      ) : tab === 'peak' ? (
        hasPeakData(peak.data) ? (
          <Panel
            kpis={
              <KpiStrip
                items={[
                  {
                    key: 'arr',
                    label: t('reports.peak.busiestArrival'),
                    value: peak.data.busiest_arrival ? formatNumber(peak.data.busiest_arrival.count) : '0',
                    delta: peak.data.busiest_arrival ? windowLabel(peak.data.busiest_arrival.t, peak.data.interval_min, t) : undefined,
                  },
                  {
                    key: 'exit',
                    label: t('reports.peak.busiestExit'),
                    value: peak.data.busiest_exit ? formatNumber(peak.data.busiest_exit.count) : '0',
                    delta: peak.data.busiest_exit ? windowLabel(peak.data.busiest_exit.t, peak.data.interval_min, t) : undefined,
                  },
                ]}
              />
            }
            chart={<PeakHoursChart data={peak.data} arrivalsLabel={t('reports.peak.arrivals')} exitsLabel={t('reports.peak.exits')} />}
            table={
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.table.timeWindow')}</TableHead>
                    <TableHead numeric>{t('reports.peak.arrivals')}</TableHead>
                    <TableHead numeric>{t('reports.peak.exits')}</TableHead>
                    {peak.data.by_gate.map((g) => (
                      <TableHead key={g.gate_id} numeric>
                        {t('reports.peak.gateArrivals', { gate: g.name })}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {peak.data.series.map((s, i) =>
                    s.arrivals || s.exits ? (
                      <TableRow key={s.t}>
                        <TableCell>{windowLabel(s.t, peak.data.interval_min, t)}</TableCell>
                        <TableCell numeric>{s.arrivals}</TableCell>
                        <TableCell numeric>{s.exits}</TableCell>
                        {peak.data.by_gate.map((g) => (
                          <TableCell key={g.gate_id} numeric>
                            {g.arrivals[i] ?? 0}
                          </TableCell>
                        ))}
                      </TableRow>
                    ) : null,
                  )}
                </TableBody>
              </Table>
            }
          />
        ) : (
          <NoData />
        )
      ) : tab === 'revenue' ? (
        !revenue.data.paid_parking ? (
          <EmptyState
            title={t('reports.revenue.off')}
            action={
              <Button asChild variant="secondary" size="md">
                <Link to="/admin/settings">{t('reports.revenue.openSettings')}</Link>
              </Button>
            }
          />
        ) : revenue.data.count_paid + revenue.data.count_free === 0 ? (
          <NoData />
        ) : (
          <Panel
            kpis={
              <KpiStrip
                items={[
                  { key: 'total', label: t('reports.revenue.total'), value: formatInr(revenue.data.total) },
                  { key: 'paid', label: t('reports.revenue.paid'), value: formatNumber(revenue.data.count_paid) },
                  { key: 'free', label: t('reports.revenue.free'), value: formatNumber(revenue.data.count_free) },
                  { key: 'cash', label: t('admin.paymentMethod.cash'), value: formatInr(revenue.data.by_method.find((m) => m.method === 'cash')?.amount ?? 0) },
                  { key: 'upi', label: t('admin.paymentMethod.upi'), value: formatInr(revenue.data.by_method.find((m) => m.method === 'upi')?.amount ?? 0) },
                ]}
              />
            }
            chart={<RevenueChart data={revenue.data} amountLabel={t('reports.revenue.amount')} />}
            table={
              <div className="grid gap-4 lg:grid-cols-2">
                <SimpleTable
                  head={[t('reports.revenue.day'), t('reports.revenue.amount'), t('reports.revenue.vehicles')]}
                  rows={revenue.data.by_day.map((d) => [d.date, formatInr(d.amount), d.count])}
                />
                <SimpleTable
                  head={[t('reports.revenue.method'), t('reports.revenue.amount'), t('reports.revenue.vehicles')]}
                  rows={revenue.data.by_method.map((m) => [t(`admin.paymentMethod.${m.method}`), formatInr(m.amount), m.count])}
                />
              </div>
            }
          />
        )
      ) : counts.data.total === 0 ? (
        <NoData />
      ) : (
        <Panel
          kpis={null}
          chart={
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-body-sm font-semibold text-muted">{t('reports.counts.byCategory')}</h3>
                <HorizontalBarChart
                  rows={counts.data.by_category.map((c) => ({ label: t(`common.enums.category.${c.category}`), count: c.count }))}
                  valueLabel={t('reports.revenue.vehicles')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-body-sm font-semibold text-muted">{t('reports.counts.byType')}</h3>
                <HorizontalBarChart
                  rows={counts.data.by_type.map((c) => ({ label: t(`common.enums.vehicleType.${c.type}`), count: c.count }))}
                  valueLabel={t('reports.revenue.vehicles')}
                />
              </div>
            </div>
          }
          table={
            <div className="flex flex-col gap-4">
              <SimpleTable
                head={[t('reports.counts.category'), ...VEHICLE_TYPES.map((ty) => t(`common.enums.vehicleType.${ty}`)), t('reports.counts.total')]}
                rows={[
                  ...counts.data.matrix.map((m) => [t(`common.enums.category.${m.category}`), ...VEHICLE_TYPES.map((ty) => m[ty]), m.total]),
                  [t('reports.counts.total'), ...VEHICLE_TYPES.map((ty) => counts.data.matrix.reduce((a, m) => a + m[ty], 0)), counts.data.total],
                ]}
              />
              <SimpleTable
                head={[t('reports.counts.quality'), '']}
                rows={[
                  [t('reports.counts.aiAccuracy'), counts.data.ai.accuracy_pct === null ? '' : `${counts.data.ai.accuracy_pct}%`],
                  [t('reports.counts.aiEdited'), `${counts.data.ai.plate_edited} / ${counts.data.ai.photos}`],
                  [t('reports.counts.waFailed'), `${counts.data.whatsapp.failed} / ${counts.data.whatsapp.sent + counts.data.whatsapp.failed}`],
                  [t('reports.counts.wrongSlots'), counts.data.confirmation.wrong_slot],
                  [t('reports.counts.locationMismatch'), counts.data.confirmation.location_mismatch],
                  [t('reports.counts.accessible'), counts.data.accessible],
                ]}
              />
            </div>
          }
        />
      )}
    </div>
  )
}

function Panel({ kpis, chart, table }: { kpis: ReactNode; chart: ReactNode; table: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {kpis}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">{chart}</div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">{table}</div>
    </div>
  )
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={i} numeric={i > 0}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} numeric={j > 0}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function NoData() {
  const { t } = useTranslation('reports')
  return (
    <div className="rounded-lg border border-line bg-surface">
      <EmptyState title={t('reports.empty')} />
    </div>
  )
}
