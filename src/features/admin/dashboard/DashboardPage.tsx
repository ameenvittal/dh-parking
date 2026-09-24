import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { CircleCheck, DoorOpen, Hourglass, LogOut, MessageCircle, Navigation, RotateCw, Siren, Square, TriangleAlert } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiStrip } from '@/components/common/KpiStrip'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BaseMap } from '@/features/map/BaseMap'
import { useMapData } from '@/features/map/useMapData'
import { useNow } from '@/features/zone/useNow'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { EventListItem } from '@/lib/demo/types'
import { formatClockSeconds, formatNumber, formatPlate, formatRelative, localName } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import type { ActivityItem, DashboardSummary } from '@/types/domain'
import { AlertDrawer } from '../alerts/AlertDrawer'
import { AlertRow } from '../alerts/AlertRow'
import { listAlerts } from '../alerts/api'
import { RequireEvent } from '../components/RequireEvent'
import { ZoneDot } from '../components/ZoneDot'
import { useLiveVehicles } from '../live/useLiveVehicles'
import { VehiclesLayer } from '../live/VehiclesLayer'
import { VisitDrawer } from '../visits/VisitDrawer'
import { getDashboardSummary, getRecentActivity } from './api'
import { useSosSound } from './useSosSound'

const DEBOUNCE_MS = 1_000

/** Dashboard `/admin` (docs/07 section 5.1, F-ADM-01). */
export function DashboardPage() {
  return <RequireEvent>{(event) => <DashboardView event={event} />}</RequireEvent>
}

function DashboardView({ event }: { event: EventListItem }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const navigate = useNavigate()
  const now = useNow()
  const [visitId, setVisitId] = useState<string | null>(null)
  const [alertId, setAlertId] = useState<string | null>(null)
  const sound = useSosSound()

  const summary = useQuery({ queryKey: queryKeys.dashboard(event.id), queryFn: () => getDashboardSummary(event.id) })
  const activity = useQuery({ queryKey: queryKeys.activity(event.id), queryFn: () => getRecentActivity(event.id, 30) })
  const alertFilters = { eventId: event.id, status: null }
  const alerts = useQuery({ queryKey: queryKeys.alertList(event.id, alertFilters), queryFn: () => listAlerts(alertFilters) })

  // Refetch on realtime changes, debounced 1 s.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChange = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard(event.id) })
      void qc.invalidateQueries({ queryKey: queryKeys.activity(event.id) })
      void qc.invalidateQueries({ queryKey: queryKeys.alerts(event.id) })
    }, DEBOUNCE_MS)
  }, [qc, event.id])
  useRealtime(['visits', 'slots', 'alerts'], onChange)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const openAlerts = useMemo(() => (alerts.data ?? []).filter((a) => a.status !== 'resolved'), [alerts.data])

  // SOS sound: beep when a new SOS appears.
  const seenSos = useRef<Set<string> | null>(null)
  const { play } = sound
  useEffect(() => {
    if (!alerts.data) return
    const sos = alerts.data.filter((a) => a.type === 'sos' && a.status === 'open').map((a) => a.id)
    const prev = seenSos.current
    if (prev && sos.some((id) => !prev.has(id))) play()
    seenSos.current = new Set(sos)
  }, [alerts.data, play])

  const s = summary.data
  const wide = useMediaQuery('(min-width: 768px)')

  return (
    <div className="flex flex-col gap-6">
      {/* Live Operations Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 shadow-raised">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-body-sm font-semibold text-ink">{t('admin.dashboard.liveOverview')}</span>
          </div>
          {s ? (
            <span className="text-body-sm text-muted">
              {t('admin.dashboard.capacityOverview', {
                occupied: s.slots.occupied,
                total: s.slots.total,
                pct: s.slots.total > 0 ? Math.round((s.slots.occupied / s.slots.total) * 100) : 0,
              })}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2 text-body-sm text-muted">
          {s ? (
            <span className="tabular-nums" aria-live="polite">
              {t('admin.shared.updatedAt', { time: formatClockSeconds(s.last_updated) })}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted hover:text-ink"
            onClick={() => void qc.invalidateQueries({ queryKey: queryKeys.dashboard(event.id) })}
            aria-label={t('admin.dashboard.refresh')}
          >
            <RotateCw size={14} className={summary.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {summary.error ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}

      {s ? (
        <KpiStrip
          items={[
            {
              key: 'free',
              label: t('admin.dashboard.kpi.free'),
              value: formatNumber(s.slots.available),
              icon: Square,
              statusColor: 'available',
            },
            {
              key: 'way',
              label: t('admin.dashboard.kpi.onTheWay'),
              value: formatNumber(s.visits.en_route),
              icon: Navigation,
              statusColor: 'enroute',
            },
            {
              key: 'wait',
              label: t('admin.dashboard.kpi.waiting'),
              value: formatNumber(s.visits.awaiting_confirm),
              icon: Hourglass,
              statusColor: 'waiting',
              tone: s.visits.awaiting_confirm > 0 ? 'warning' : 'default',
            },
            {
              key: 'parked',
              label: t('admin.dashboard.kpi.parked'),
              value: formatNumber(s.visits.confirmed),
              icon: CircleCheck,
              statusColor: 'occupied',
            },
            {
              key: 'left',
              label: t('admin.dashboard.kpi.left'),
              value: formatNumber(s.visits.exited),
              icon: LogOut,
              statusColor: 'exited',
            },
            {
              key: 'alerts',
              label: t('admin.dashboard.kpi.alerts'),
              value: formatNumber(s.alerts.open),
              icon: s.alerts.sos_open > 0 ? Siren : TriangleAlert,
              statusColor: s.alerts.sos_open > 0 ? 'danger' : s.alerts.open > 0 ? 'warning' : undefined,
              tone: s.alerts.sos_open > 0 ? 'danger' : 'default',
              delta: s.alerts.sos_open > 0 ? t('admin.dashboard.kpi.sosOpen', { count: s.alerts.sos_open }) : undefined,
              onClick: () => void navigate('/admin/alerts'),
            },
          ]}
          footer={<CapacityDistribution s={s} />}
        />
      ) : summary.isLoading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-raised xl:col-span-8">
          <div className="flex h-13 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-h3 font-bold text-ink">{t('admin.dashboard.liveMap')}</h2>
              {s && s.visits.en_route > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-enroute-soft px-2.5 py-0.5 text-caption font-semibold text-status-enroute">
                  <Navigation size={12} strokeWidth={2.5} />
                  {t('admin.dashboard.movingCount', { count: s.visits.en_route })}
                </span>
              ) : null}
            </div>
            <Link to="/admin/live" className="text-body-sm font-semibold text-primary underline-offset-4 hover:underline">
              {t('admin.dashboard.openLiveMap')}
            </Link>
          </div>
          <DashboardMap eventId={event.id} onVehicle={setVisitId} />
        </section>

        <section className="flex min-h-96 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-raised xl:col-span-4 xl:max-h-146">
          <Tabs defaultValue="alerts" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="px-2 pt-2">
              <TabsTrigger value="alerts" className="gap-2">
                {t('admin.dashboard.tabs.alerts')}
                {openAlerts.length ? (
                  <span className={cn('rounded-full px-2 py-0.5 text-caption font-bold tabular-nums', alerts.data?.some(a => a.type === 'sos' && a.status === 'open') ? 'bg-danger text-white' : 'bg-surface-2 text-ink')}>
                    {openAlerts.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="activity">{t('admin.dashboard.tabs.activity')}</TabsTrigger>
            </TabsList>
            <TabsContent value="alerts" className="flex min-h-0 flex-1 flex-col">
              <SwitchRow
                label={t('admin.dashboard.sosSound')}
                checked={sound.enabled}
                onCheckedChange={sound.toggle}
                className="border-b border-line px-4"
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {alerts.isLoading ? (
                  <Skeleton className="m-4 h-32" />
                ) : alerts.error ? (
                  <ErrorState className="m-4 w-auto" error={alerts.error} onRetry={() => void alerts.refetch()} />
                ) : openAlerts.length === 0 ? (
                  <EmptyState title={t('admin.dashboard.noAlerts')} />
                ) : (
                  <ul className="divide-y divide-line">
                    {openAlerts.map((a) => (
                      <AlertRow key={a.id} alert={a} now={now} compact onClick={() => setAlertId(a.id)} />
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
            <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto">
              {activity.isLoading ? (
                <Skeleton className="m-4 h-32" />
              ) : activity.error ? (
                <ErrorState className="m-4 w-auto" error={activity.error} onRetry={() => void activity.refetch()} />
              ) : (activity.data ?? []).length === 0 ? (
                <EmptyState title={t('admin.dashboard.noActivity')} />
              ) : (
                <ul className="divide-y divide-line">
                  {(activity.data ?? []).map((item) => (
                    <ActivityRow key={item.id} item={item} now={now} onClick={() => setVisitId(item.visit_id)} />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 font-bold text-ink">{t('admin.dashboard.zones')}</h2>
        {s ? (
          s.zones.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface shadow-raised">
              <EmptyState title={t('admin.dashboard.noZones')} />
            </div>
          ) : wide ? (
            <ZonesTable zones={s.zones} lang={i18n.language} onRow={(id) => void navigate(`/admin/zones?zone=${id}`)} />
          ) : (
            <ZonesList zones={s.zones} lang={i18n.language} onRow={(id) => void navigate(`/admin/zones?zone=${id}`)} />
          )
        ) : (
          <Skeleton className="h-40 w-full rounded-lg" />
        )}
      </section>

      {s ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-raised">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <DoorOpen size={18} className="text-muted" />
              <h2 className="text-h3 font-bold text-ink">{t('admin.dashboard.gates')}</h2>
            </div>
            {s.gates.length === 0 ? (
              <p className="text-body-sm text-muted">{t('admin.dashboard.noGates')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.gates.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4 py-2.5 text-body-sm">
                    <span className="font-semibold text-ink">{g.name}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="rounded-md bg-status-available-soft px-2 py-0.5 text-caption font-medium text-status-available">
                        {t('admin.dashboard.gateIn', { count: g.checkins_15m })}
                      </span>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-caption font-medium text-muted">
                        {t('admin.dashboard.gateOut', { count: g.exits_15m })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 shadow-raised">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <MessageCircle size={18} className="text-muted" />
              <h2 className="text-h3 font-bold text-ink">{t('admin.dashboard.whatsapp')}</h2>
            </div>
            <WaStats wa={s.wa} />
          </section>
        </div>
      ) : null}

      <VisitDrawer visitId={visitId} onOpenChange={(o) => !o && setVisitId(null)} />
      <AlertDrawer
        alertId={alertId}
        onOpenChange={(o) => !o && setAlertId(null)}
        onOpenVehicle={(id) => {
          setAlertId(null)
          setVisitId(id)
        }}
      />
    </div>
  )
}

function CapacityDistribution({ s }: { s: DashboardSummary }) {
  const { t } = useTranslation('admin')
  const total = Math.max(1, s.slots.total)
  const parkedPct = Math.round((s.slots.occupied / total) * 100)
  const waitingPct = Math.round((s.visits.awaiting_confirm / total) * 100)
  const wayPct = Math.round((s.visits.en_route / total) * 100)
  const freePct = Math.max(0, 100 - (parkedPct + waitingPct + wayPct))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-caption font-semibold text-muted">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-status-occupied" />
            <span className="text-ink">{s.slots.occupied}</span> {t('admin.dashboard.kpi.parked')}
          </span>
          {s.visits.awaiting_confirm > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-status-waiting" />
              <span className="text-ink">{s.visits.awaiting_confirm}</span> {t('admin.dashboard.kpi.waiting')}
            </span>
          ) : null}
          {s.visits.en_route > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-status-enroute" />
              <span className="text-ink">{s.visits.en_route}</span> {t('admin.dashboard.kpi.onTheWay')}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-status-available" />
            <span className="text-ink">{s.slots.available}</span> {t('admin.dashboard.kpi.free')}
          </span>
        </span>
        <span className="tabular-nums font-bold text-ink">{parkedPct}% filled</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={parkedPct} aria-valuemin={0} aria-valuemax={100}>
        {parkedPct > 0 ? <div style={{ width: `${parkedPct}%` }} className="h-full bg-status-occupied transition-all" /> : null}
        {waitingPct > 0 ? <div style={{ width: `${waitingPct}%` }} className="h-full bg-status-waiting transition-all" /> : null}
        {wayPct > 0 ? <div style={{ width: `${wayPct}%` }} className="h-full bg-status-enroute transition-all" /> : null}
        {freePct > 0 ? <div style={{ width: `${freePct}%` }} className="h-full bg-status-available transition-all" /> : null}
      </div>
    </div>
  )
}

function DashboardMap({ eventId, onVehicle }: { eventId: string; onVehicle: (visitId: string) => void }) {
  const { t } = useTranslation('admin')
  const { eventMap, slotStatuses, error, refetch } = useMapData(eventId)
  const { vehicles } = useLiveVehicles(eventId)
  if (error) return <ErrorState className="m-4 w-auto" error={error} onRetry={refetch} />
  if (!eventMap) return <Skeleton className="h-80 rounded-none lg:h-130" />
  return (
    <div className="h-80 lg:h-130">
      <BaseMap eventMap={eventMap} baseLayer={eventMap.event.base_map} slotStatuses={slotStatuses} showRoads ariaLabel={t('admin.dashboard.liveMap')}>
        <VehiclesLayer vehicles={vehicles} onVehicleClick={onVehicle} />
      </BaseMap>
    </div>
  )
}

function ActivityRow({ item, now, onClick }: { item: ActivityItem; now: number; onClick: () => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-baseline justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
      >
        <span className="text-body-sm text-ink">
          {t(`admin.activity.${item.type}`, { plate: formatPlate(item.plate), slot: item.slot_label ?? '' })}
        </span>
        <span className="shrink-0 text-caption text-muted tabular-nums">{formatRelative(item.created_at, t, now)}</span>
      </button>
    </li>
  )
}

type ZoneRow = DashboardSummary['zones'][number]

function OccupancyBar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct <= 1 && pct > 0 ? pct * 100 : pct)))
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <span className={cn('block h-full rounded-full', v >= 90 ? 'bg-danger' : 'bg-primary')} style={{ width: `${v}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{v}%</span>
    </span>
  )
}

function TypeIcons({ types }: { types: ZoneRow['vehicle_types'] }) {
  const { t } = useTranslation('common')
  return (
    <span className="inline-flex gap-1.5">
      {types.map((ty) => {
        const Icon = vehicleTypeIcon[ty]
        return <Icon key={ty} size={16} strokeWidth={1.75} className="text-muted" aria-label={t(`enums.vehicleType.${ty}`)} role="img" />
      })}
    </span>
  )
}

function ZonesTable({ zones, lang, onRow }: { zones: ZoneRow[]; lang: string; onRow: (id: string) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('admin.dashboard.zonesTable.zone')}</TableHead>
            <TableHead>{t('admin.dashboard.zonesTable.types')}</TableHead>
            <TableHead>{t('admin.dashboard.zonesTable.categories')}</TableHead>
            <TableHead numeric>{t('admin.dashboard.zonesTable.free')}</TableHead>
            <TableHead numeric>{t('admin.dashboard.zonesTable.assigned')}</TableHead>
            <TableHead numeric>{t('admin.dashboard.zonesTable.parked')}</TableHead>
            <TableHead numeric>{t('admin.dashboard.zonesTable.blocked')}</TableHead>
            <TableHead numeric>{t('admin.dashboard.zonesTable.occupancy')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {zones.map((z) => (
            <TableRow key={z.id} className="cursor-pointer" onClick={() => onRow(z.id)}>
              <TableCell>
                <button type="button" className="flex items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={() => onRow(z.id)}>
                  <ZoneDot color={z.color} />
                  <span className="font-semibold">{z.code}</span>
                  <span className="text-muted">{localName(z, lang)}</span>
                </button>
              </TableCell>
              <TableCell>
                <TypeIcons types={z.vehicle_types} />
              </TableCell>
              <TableCell className="text-muted">
                {z.categories.length === 0
                  ? t('admin.dashboard.zonesTable.allCategories')
                  : z.categories.map((c) => t(`common.enums.category.${c}`)).join(', ')}
              </TableCell>
              <TableCell numeric>{z.available}</TableCell>
              <TableCell numeric>{z.assigned}</TableCell>
              <TableCell numeric>{z.occupied}</TableCell>
              <TableCell numeric>{z.blocked}</TableCell>
              <TableCell numeric>
                <OccupancyBar pct={z.occupancy_pct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Phones: tables become stacked lists. */
function ZonesList({ zones, lang, onRow }: { zones: ZoneRow[]; lang: string; onRow: (id: string) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
      {zones.map((z) => (
        <li key={z.id}>
          <button type="button" onClick={() => onRow(z.id)} className="flex w-full flex-col gap-2 px-4 py-3 text-left outline-none active:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset">
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <ZoneDot color={z.color} />
                <span className="font-semibold text-ink">{z.code}</span>
                <span className="truncate text-muted">{localName(z, lang)}</span>
              </span>
              <OccupancyBar pct={z.occupancy_pct} />
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted tabular-nums">
              <span>{t('admin.dashboard.zonesTable.free')} {z.available}</span>
              <span>{t('admin.dashboard.zonesTable.assigned')} {z.assigned}</span>
              <span>{t('admin.dashboard.zonesTable.parked')} {z.occupied}</span>
              <span>{t('admin.dashboard.zonesTable.blocked')} {z.blocked}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function WaStats({ wa }: { wa: DashboardSummary['wa'] }) {
  const { t } = useTranslation('admin')
  const cells = [
    { key: 'sent', value: wa.sent },
    { key: 'delivered', value: wa.delivered },
    { key: 'read', value: wa.read },
  ]
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.key} className="flex flex-col">
            <dt className="text-body-sm text-muted">{t(`admin.dashboard.wa.${c.key}`)}</dt>
            <dd className="text-h2 text-ink tabular-nums">{formatNumber(c.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className={cn('text-body-sm', wa.failed > 0 ? 'text-danger' : 'text-muted')}>
          {t('admin.dashboard.wa.failed')} <span className="font-semibold tabular-nums">{formatNumber(wa.failed)}</span>
        </span>
        {wa.failed > 0 ? (
          <Link to="/admin/vehicles?wa=failed" className="text-body-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t('admin.dashboard.wa.showFailed')}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
