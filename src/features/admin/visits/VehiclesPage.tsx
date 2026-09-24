import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Clock, Download, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PlateChip } from '@/components/common/PlateChip'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { EventListItem, VisitListFilters } from '@/lib/demo/types'
import { formatClock, isoDay } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { VEHICLE_TYPES, VISIT_STATUSES, VISITOR_CATEGORIES, type VehicleType, type VisitStatus, type VisitSummary, type VisitorCategory, type WaStatus } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { MultiFilter } from '../components/MultiFilter'
import { Pagination } from '../components/Pagination'
import { RequireEvent } from '../components/RequireEvent'
import { useDebounced } from '../components/useDebounced'
import { listVisits } from './api'
import { exportVisitList } from './exportVisitList'
import { VisitDrawer } from './VisitDrawer'

const PAGE_SIZE = 50
type TimeRange = 'all' | 'today' | 'custom'

/** Vehicles `/admin/vehicles` (docs/07 section 5.3, F-ADM-04). */
export function VehiclesPage() {
  return <RequireEvent>{(event) => <VehiclesView event={event} />}</RequireEvent>
}

function VehiclesView({ event }: { event: EventListItem }) {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const errorText = useErrorText()
  const wide = useMediaQuery('(min-width: 768px)')
  const [params] = useSearchParams()
  const { eventMap } = useMapData(event.id, { withStatuses: false })

  const [search, setSearch] = useState('')
  const query = useDebounced(search.trim(), 300)
  const [statuses, setStatuses] = useState<VisitStatus[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [types, setTypes] = useState<VehicleType[]>([])
  const [categories, setCategories] = useState<VisitorCategory[]>([])
  const [gate, setGate] = useState('')
  const [range, setRange] = useState<TimeRange>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [waFailed, setWaFailed] = useState(params.get('wa') === 'failed')
  const [page, setPage] = useState(0)
  const [visitId, setVisitId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const filters: VisitListFilters = useMemo(() => {
    let fromIso: string | null = null
    let toIso: string | null = null
    if (range === 'today') {
      const start = new Date(`${isoDay(new Date())}T00:00:00+05:30`)
      fromIso = start.toISOString()
      toIso = new Date(start.getTime() + 86_400_000).toISOString()
    } else if (range === 'custom') {
      fromIso = from ? new Date(`${from}:00+05:30`).toISOString() : null
      toIso = to ? new Date(`${to}:00+05:30`).toISOString() : null
    }
    return {
      eventId: event.id,
      query: query || undefined,
      statuses: statuses.length ? statuses : undefined,
      zoneIds: zones.length ? zones : undefined,
      vehicleTypes: types.length ? types : undefined,
      categories: categories.length ? categories : undefined,
      gateId: gate || null,
      from: fromIso,
      to: toIso,
      waFailed: waFailed || undefined,
    }
  }, [event.id, query, statuses, zones, types, categories, gate, range, from, to, waFailed])

  const list = useQuery({ queryKey: queryKeys.visitList(event.id, filters), queryFn: () => listVisits(filters) })
  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: queryKeys.adminVisits(event.id) }), [qc, event.id])
  useRealtime(['visits', 'whatsapp_messages'], onChange)

  const rows = list.data ?? []
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const filtered =
    Boolean(query) || statuses.length > 0 || zones.length > 0 || types.length > 0 || categories.length > 0 || Boolean(gate) || range !== 'all' || waFailed

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setPage(0)
  }
  const clearAll = () => {
    setSearch('')
    setStatuses([])
    setZones([])
    setTypes([])
    setCategories([])
    setGate('')
    setRange('all')
    setWaFailed(false)
    setPage(0)
  }

  const clearLabel = t('admin.shared.clearFilters')
  const zoneOptions = (eventMap?.zones.features ?? []).map((z) => ({ value: String(z.id), label: `${z.properties.code} ${z.properties.name}` }))
  const gateOptions = (eventMap?.gates.features ?? []).map((g) => ({ value: String(g.id), label: g.properties.name }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder={t('admin.vehicles.searchPlaceholder')}
              aria-label={t('admin.shared.search')}
              className="pl-9"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            className={ADMIN_BTN}
            icon={<Download size={16} strokeWidth={1.75} aria-hidden="true" />}
            loading={exporting}
            disabled={rows.length === 0}
            onClick={async () => {
              setExporting(true)
              try {
                await exportVisitList(rows, event.name, t)
                toast.success(t('admin.vehicles.exported'))
              } catch (err) {
                toast.error(errorText(err))
              } finally {
                setExporting(false)
              }
            }}
          >
            {t('admin.vehicles.exportExcel')}
          </Button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          <MultiFilter
            label={t('admin.vehicles.filter.status')}
            value={statuses}
            onChange={reset(setStatuses)}
            clearLabel={clearLabel}
            options={VISIT_STATUSES.map((s) => ({ value: s, label: t(`common.enums.visitStatus.${s}`) }))}
          />
          <MultiFilter label={t('admin.vehicles.filter.zone')} value={zones} onChange={reset(setZones)} clearLabel={clearLabel} options={zoneOptions} />
          <MultiFilter
            label={t('admin.vehicles.filter.type')}
            value={types}
            onChange={reset(setTypes)}
            clearLabel={clearLabel}
            options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`common.enums.vehicleType.${v}`) }))}
          />
          <MultiFilter
            label={t('admin.vehicles.filter.category')}
            value={categories}
            onChange={reset(setCategories)}
            clearLabel={clearLabel}
            options={VISITOR_CATEGORIES.map((c) => ({ value: c, label: t(`common.enums.category.${c}`) }))}
          />
          <Select
            aria-label={t('admin.vehicles.filter.gate')}
            value={gate}
            onChange={(e) => reset(setGate)(e.target.value)}
            className="w-40 shrink-0"
            options={[{ value: '', label: `${t('admin.vehicles.filter.gate')}: ${t('admin.shared.all')}` }, ...gateOptions]}
          />
          <Select
            aria-label={t('admin.vehicles.filter.time')}
            value={range}
            onChange={(e) => reset(setRange)(e.target.value as TimeRange)}
            className="w-40 shrink-0"
            options={[
              { value: 'all', label: t('admin.vehicles.filter.allTime') },
              { value: 'today', label: t('admin.vehicles.filter.today') },
              { value: 'custom', label: t('admin.vehicles.filter.custom') },
            ]}
          />
          <button
            type="button"
            aria-pressed={waFailed}
            onClick={() => reset(setWaFailed)(!waFailed)}
            className={
              waFailed
                ? 'inline-flex h-11 shrink-0 items-center rounded-md border border-primary bg-primary-soft px-3 text-body-sm font-semibold text-primary lg:h-9'
                : 'inline-flex h-11 shrink-0 items-center rounded-md border border-line-strong bg-surface px-3 text-body-sm font-semibold text-ink hover:bg-surface-2 lg:h-9'
            }
          >
            {t('admin.vehicles.filter.waFailed')}
          </button>
          {filtered ? (
            <Button variant="ghost" size="md" className={ADMIN_BTN} onClick={clearAll}>
              {clearLabel}
            </Button>
          ) : null}
        </div>
        {range === 'custom' ? (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <label className="flex flex-col gap-1 text-body-sm font-semibold text-ink">
              {t('admin.vehicles.filter.from')}
              <Input type="datetime-local" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-body-sm font-semibold text-ink">
              {t('admin.vehicles.filter.to')}
              <Input type="datetime-local" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
            </label>
          </div>
        ) : null}
      </div>

      {list.error ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : null}

      {list.isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState title={filtered ? t('admin.vehicles.empty') : t('admin.vehicles.emptyNone')} />
        </div>
      ) : wide ? (
        <VisitsTable rows={pageRows} onRow={setVisitId} />
      ) : (
        <VisitsList rows={pageRows} onRow={setVisitId} />
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
      <VisitDrawer visitId={visitId} onOpenChange={(o) => !o && setVisitId(null)} />
    </div>
  )
}

function WaIcon({ status }: { status: WaStatus | null }) {
  const { t } = useTranslation('admin')
  const label = t(`admin.waStatus.${status ?? 'none'}`)
  if (status === 'failed') return <CircleAlert size={16} strokeWidth={1.75} className="text-danger" aria-label={label} role="img" />
  if (status === 'delivered' || status === 'read') return <CircleCheck size={16} strokeWidth={1.75} className="text-success" aria-label={label} role="img" />
  if (status === 'sent' || status === 'queued') return <Clock size={16} strokeWidth={1.75} className="text-muted" aria-label={label} role="img" />
  return <span className="text-muted">{t('admin.shared.dash')}</span>
}

function VisitsTable({ rows, onRow }: { rows: VisitSummary[]; onRow: (id: string) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const time = (iso: string | null) => (iso ? formatClock(iso) : '')
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Table className="whitespace-nowrap">
        <TableHeader>
          <TableRow>
            {(['plate', 'type', 'category', 'slot', 'zone', 'status', 'phone', 'checkedIn', 'parked', 'left', 'gate', 'whatsapp'] as const).map((c) => (
              <TableHead key={c}>{t(`admin.vehicles.columns.${c}`)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((v) => (
            <TableRow key={v.id} className="cursor-pointer" onClick={() => onRow(v.id)}>
              <TableCell>
                <button type="button" onClick={() => onRow(v.id)} className="rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <PlateChip plate={v.plate} size="sm" />
                </button>
              </TableCell>
              <TableCell>{t(`common.enums.vehicleType.${v.vehicle_type}`)}</TableCell>
              <TableCell>{t(`common.enums.category.${v.category}`)}</TableCell>
              <TableCell className="font-display font-bold tabular-nums">{v.slot_label ?? ''}</TableCell>
              <TableCell>{v.zone_code ?? ''}</TableCell>
              <TableCell>
                <StatusBadge status={v.status} vehicleType={v.vehicle_type} />
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{v.phone ?? v.phone_masked}</TableCell>
              <TableCell className="tabular-nums">{time(v.checked_in_at)}</TableCell>
              <TableCell className="tabular-nums">{time(v.confirmed_at ?? v.driver_parked_at)}</TableCell>
              <TableCell className="tabular-nums">{time(v.exited_at)}</TableCell>
              <TableCell>{v.entry_gate_name ?? ''}</TableCell>
              <TableCell>
                <WaIcon status={v.wa_status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Phones: stacked list instead of a table. */
function VisitsList({ rows, onRow }: { rows: VisitSummary[]; onRow: (id: string) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map((v) => (
        <li key={v.id}>
          <button type="button" onClick={() => onRow(v.id)} className="flex w-full flex-col gap-2 px-4 py-3 text-left outline-none active:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset">
            <span className="flex items-center justify-between gap-3">
              <PlateChip plate={v.plate} size="sm" />
              <StatusBadge status={v.status} vehicleType={v.vehicle_type} />
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted">
              {v.slot_label ? <span className="font-display font-bold text-ink">{v.slot_label}</span> : null}
              <span>{t(`common.enums.vehicleType.${v.vehicle_type}`)}</span>
              <span>{t(`common.enums.category.${v.category}`)}</span>
              <span className="tabular-nums">{formatClock(v.checked_in_at)}</span>
              <WaIcon status={v.wa_status} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
