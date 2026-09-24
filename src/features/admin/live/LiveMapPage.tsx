import { useMutation, useQuery } from '@tanstack/react-query'
import { PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/ErrorState'
import { PlateChip } from '@/components/common/PlateChip'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { BaseMap } from '@/features/map/BaseMap'
import { MapControls } from '@/features/map/MapControls'
import { useMapContext } from '@/features/map/mapContext'
import { useMapData } from '@/features/map/useMapData'
import { useNow } from '@/features/zone/useNow'
import { useErrorText } from '@/hooks/useErrorText'
import type { EventListItem } from '@/lib/demo/types'
import { formatPlate, formatRelative } from '@/lib/format'
import { normalizePlate } from '@/lib/plate'
import { queryKeys } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'
import type { BaseMapKind, SlotStatus } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { RequireEvent } from '../components/RequireEvent'
import { TrailLayer } from '../components/TrailLayer'
import { useAdminRefresh } from '../components/useAdminRefresh'
import { getDashboardSummary } from '../dashboard/api'
import { VisitDrawer } from '../visits/VisitDrawer'
import { getVisitDetail, setSlotsStatus } from './api'
import { TRAFFIC_REFRESH_MS, computeTraffic } from './traffic'
import { TrafficLayer } from './TrafficLayer'
import { useLiveVehicles, type LiveVehicleView } from './useLiveVehicles'
import { VehiclesLayer } from './VehiclesLayer'

/** Live map `/admin/live` (docs/07 section 5.2, docs/05 section 9, F-ADM-02). */
export function LiveMapPage() {
  return <RequireEvent>{(event) => <LiveView event={event} />}</RequireEvent>
}

type Selection = { kind: 'vehicle'; id: string } | { kind: 'slot'; id: string } | null

function LiveView({ event }: { event: EventListItem }) {
  const { t } = useTranslation(['admin', 'common'])
  const now = useNow(5_000)
  const { eventMap, slotStatuses, slotRows, error, refetch } = useMapData(event.id)
  const { vehicles } = useLiveVehicles(event.id)
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches)
  const [search, setSearch] = useState('')
  const [show, setShow] = useState({ moving: true, waiting: true, traffic: true, roads: true })
  const [base, setBase] = useState<BaseMapKind | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [trailFor, setTrailFor] = useState<string | null>(null)
  const [drawerVisit, setDrawerVisit] = useState<string | null>(null)
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; n: number } | null>(null)

  const gates = useQuery({
    queryKey: queryKeys.dashboard(event.id),
    queryFn: () => getDashboardSummary(event.id),
    refetchInterval: 30_000,
  })

  const shown = useMemo(
    () =>
      vehicles.filter((v) => (v.status === 'driver_parked' ? show.waiting : show.moving)),
    [vehicles, show.moving, show.waiting],
  )

  // Congestion recomputed every 5 s from the live positions.
  const [traffic, setTraffic] = useState<Map<string, number>>(new Map())
  const moving = vehicles.filter((v) => v.status === 'assigned' || v.status === 'en_route')
  const movingKey = moving.map((v) => `${v.visit_id}:${v.lng.toFixed(5)},${v.lat.toFixed(5)}`).join('|')
  const movingRef = useRef(moving)
  useEffect(() => {
    movingRef.current = moving
  })
  useEffect(() => {
    if (!eventMap) return
    const run = () => setTraffic(computeTraffic(eventMap.roads, movingRef.current))
    run()
    const id = setInterval(run, TRAFFIC_REFRESH_MS)
    return () => clearInterval(id)
  }, [eventMap, movingKey])

  const trail = useQuery({
    queryKey: queryKeys.visitDetail(trailFor ?? ''),
    queryFn: () => getVisitDetail(trailFor ?? ''),
    enabled: Boolean(trailFor),
  })

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!eventMap) return <Skeleton className="h-app w-full rounded-none" />

  const q = normalizePlate(search)
  const list = moving.filter((v) => !q || v.plate.includes(q))
  const selectedVehicle = selection?.kind === 'vehicle' ? vehicles.find((v) => v.visit_id === selection.id) ?? null : null

  return (
    <div className="relative h-full min-h-120 w-full">
      <BaseMap
        eventMap={eventMap}
        baseLayer={base ?? eventMap.event.base_map}
        slotStatuses={slotStatuses}
        showRoads={show.roads}
        highlightSlotId={selection?.kind === 'slot' ? selection.id : undefined}
        onSlotClick={(id) => setSelection({ kind: 'slot', id })}
        ariaLabel={t('admin.live.title')}
      >
        <TrafficLayer roads={eventMap.roads} counts={traffic} visible={show.traffic} />
        <TrailLayer trail={trailFor ? trail.data?.trail ?? null : null} />
        <VehiclesLayer vehicles={shown} onVehicleClick={(id) => setSelection({ kind: 'vehicle', id })} />
        <FlyTo target={flyTo} />
        <MapControls baseLayer={base ?? eventMap.event.base_map} onBaseLayerChange={setBase} />
      </BaseMap>

      {panelOpen ? (
        <div className="pointer-events-none absolute inset-y-3 left-3 z-10 flex w-80 max-w-3/4 items-start">
        <aside
          aria-label={t('admin.live.panel')}
          className="pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-lg bg-surface shadow-overlay"
        >
          <div className="flex items-center gap-2 border-b border-line p-3">
            <div className="relative flex-1">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.live.searchPlate')} aria-label={t('admin.live.searchPlate')} className="pl-9" />
            </div>
            <button
              type="button"
              aria-label={t('admin.live.togglePanel')}
              onClick={() => setPanelOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 lg:size-9"
            >
              <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <fieldset className="grid grid-cols-2 gap-x-3 gap-y-1 border-b border-line px-4 py-2">
            <legend className="sr-only">{t('admin.live.show')}</legend>
            {(['moving', 'waiting', 'traffic', 'roads'] as const).map((k) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-ink lg:min-h-8">
                <Checkbox checked={show[k]} onCheckedChange={(c) => setShow((s) => ({ ...s, [k]: c === true }))} />
                {t(`admin.live.${k}`)}
              </label>
            ))}
          </fieldset>
          <h2 className="px-4 pt-3 pb-1 text-body-sm font-semibold text-muted">{t('admin.live.movingVehicles', { count: moving.length })}</h2>
          <ul className="min-h-0 flex-1 overflow-y-auto pb-2">
            {list.length === 0 ? (
              <li className="px-4 py-3 text-body-sm text-muted">{t('admin.live.noMoving')}</li>
            ) : (
              list.map((v) => (
                <li key={v.visit_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFlyTo({ lng: v.lng, lat: v.lat, n: Date.now() })
                      setSelection({ kind: 'vehicle', id: v.visit_id })
                    }}
                    className={cn('flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-canvas', v.faded && 'opacity-60')}
                  >
                    <PlateChip plate={v.plate} size="sm" />
                    <span className="font-display font-bold tabular-nums">{v.slot_label ?? ''}</span>
                    <span className="text-caption text-muted">{formatRelative(v.at, t, now)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {gates.data && gates.data.gates.length > 0 ? (
            <div className="border-t border-line px-4 py-2">
              <h2 className="text-caption text-muted">{t('admin.live.gateThroughput')}</h2>
              <ul>
                {gates.data.gates.map((g) => (
                  <li key={g.id} className="flex justify-between gap-2 text-body-sm">
                    <span className="truncate">{g.name}</span>
                    <span className="flex gap-3 text-muted tabular-nums">
                      <span>{t('admin.dashboard.gateIn', { count: g.checkins_15m })}</span>
                      <span>{t('admin.dashboard.gateOut', { count: g.exits_15m })}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
        </div>
      ) : (
        <button
          type="button"
          aria-label={t('admin.live.togglePanel')}
          onClick={() => setPanelOpen(true)}
          className="absolute top-3 left-3 z-10 inline-flex size-11 items-center justify-center rounded-lg bg-surface text-ink shadow-overlay"
        >
          <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}

      <Legend />

      {selection ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-lg bg-surface p-4 shadow-overlay sm:inset-x-auto sm:right-3 sm:w-80">
          <button
            type="button"
            aria-label={t('admin.shared.close')}
            onClick={() => setSelection(null)}
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 lg:size-9"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {selection.kind === 'vehicle' ? (
            selectedVehicle ? (
              <VehicleCardPopover
                v={selectedVehicle}
                now={now}
                trailOn={trailFor === selectedVehicle.visit_id}
                onTrail={() => setTrailFor((cur) => (cur === selectedVehicle.visit_id ? null : selectedVehicle.visit_id))}
                onOpen={() => setDrawerVisit(selectedVehicle.visit_id)}
              />
            ) : null
          ) : (
            <SlotPopover
              slotId={selection.id}
              label={eventMap.slots.features.find((f) => String(f.id) === selection.id)?.properties.label ?? ''}
              status={slotStatuses?.get(selection.id) ?? null}
              visitId={slotRows?.find((r) => r.id === selection.id)?.current_visit_id ?? null}
              onOpenVisit={setDrawerVisit}
            />
          )}
        </div>
      ) : null}

      <VisitDrawer visitId={drawerVisit} onOpenChange={(o) => !o && setDrawerVisit(null)} />
    </div>
  )
}

function FlyTo({ target }: { target: { lng: number; lat: number; n: number } | null }) {
  const { map } = useMapContext()
  useEffect(() => {
    if (map && target) map.flyTo({ center: [target.lng, target.lat], zoom: Math.max(map.getZoom(), 18), duration: 600 })
  }, [map, target])
  return null
}

function VehicleCardPopover({ v, now, trailOn, onTrail, onOpen }: { v: LiveVehicleView; now: number; trailOn: boolean; onTrail: () => void; onOpen: () => void }) {
  const { t } = useTranslation(['admin', 'common'])
  return (
    <div className="flex flex-col gap-3 pr-8">
      <div className="flex flex-wrap items-center gap-2">
        <PlateChip plate={v.plate} size="md" />
        <StatusBadge status={v.status} vehicleType={v.vehicle_type} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-body-sm">
        <div>
          <dt className="text-muted">{t('admin.live.popover.slot')}</dt>
          <dd className="font-display font-bold">{v.slot_label ?? ''}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('admin.live.popover.lastSeen')}</dt>
          <dd>{formatRelative(v.at, t, now)}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={onTrail}>
          {trailOn ? t('admin.live.popover.hideTrail') : t('admin.live.popover.showTrail')}
        </Button>
        <Button size="md" className={ADMIN_BTN} onClick={onOpen}>
          {t('admin.live.popover.openDetails')}
        </Button>
      </div>
    </div>
  )
}

function SlotPopover({
  slotId,
  label,
  status,
  visitId,
  onOpenVisit,
}: {
  slotId: string
  label: string
  status: SlotStatus | null
  visitId: string | null
  onOpenVisit: (id: string) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const refresh = useAdminRefresh()
  const [reason, setReason] = useState('')
  const visit = useQuery({ queryKey: queryKeys.visitDetail(visitId ?? ''), queryFn: () => getVisitDetail(visitId ?? ''), enabled: Boolean(visitId) })
  const mutation = useMutation({
    mutationFn: (to: 'available' | 'blocked') => setSlotsStatus([slotId], to, to === 'blocked' ? reason.trim() : null),
    onSuccess: (_r, to) => {
      toast.success(t(to === 'blocked' ? 'admin.live.popover.blocked' : 'admin.live.popover.unblocked'))
      setReason('')
      refresh()
    },
    onError: (err) => toast.error(errorText(err)),
  })
  return (
    <div className="flex flex-col gap-3 pr-8">
      <div className="flex items-center gap-3">
        <span className="font-display text-h2 font-bold tabular-nums">{label}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      {visitId && visit.data ? (
        <div className="flex items-center justify-between gap-2">
          <span aria-label={formatPlate(visit.data.visit.plate)}>
            <PlateChip plate={visit.data.visit.plate} size="sm" />
          </span>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => onOpenVisit(visitId)}>
            {t('admin.live.popover.openVehicle')}
          </Button>
        </div>
      ) : !visitId ? (
        <p className="text-body-sm text-muted">{t('admin.live.popover.noVehicle')}</p>
      ) : null}
      {status === 'available' ? (
        <div className="flex flex-col gap-2">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('admin.live.popover.blockReasonPlaceholder')} aria-label={t('admin.live.popover.blockReason')} />
          <Button variant="secondary" size="md" className={ADMIN_BTN} disabled={!reason.trim()} loading={mutation.isPending} onClick={() => mutation.mutate('blocked')}>
            {t('admin.live.popover.block')}
          </Button>
        </div>
      ) : status === 'blocked' ? (
        <Button variant="secondary" size="md" className={ADMIN_BTN} loading={mutation.isPending} onClick={() => mutation.mutate('available')}>
          {t('admin.live.popover.unblock')}
        </Button>
      ) : null}
    </div>
  )
}

function Legend() {
  const { t } = useTranslation(['admin', 'common'])
  const slots: { key: SlotStatus | 'waiting'; cls: string; label: string }[] = [
    { key: 'available', cls: 'bg-status-available', label: t('common.enums.slotStatus.available') },
    { key: 'assigned', cls: 'bg-status-assigned', label: t('common.enums.slotStatus.assigned') },
    { key: 'waiting', cls: 'bg-status-waiting', label: t('admin.live.waiting') },
    { key: 'occupied', cls: 'bg-status-occupied', label: t('common.enums.slotStatus.occupied') },
    { key: 'blocked', cls: 'bg-status-blocked', label: t('common.enums.slotStatus.blocked') },
  ]
  const traffic = [
    { cls: 'bg-map-road', label: t('admin.live.trafficLight') },
    { cls: 'bg-traffic-medium', label: t('admin.live.trafficBusy') },
    { cls: 'bg-traffic-high', label: t('admin.live.trafficJammed') },
  ]
  return (
    <div className="absolute bottom-3 left-3 z-10 hidden flex-col gap-2 rounded-lg bg-surface px-3 py-2 text-caption text-muted shadow-overlay md:flex">
      <span className="sr-only">{t('admin.live.legend')}</span>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {slots.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-xs', s.cls)} />
            {s.label}
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <li className="font-semibold">{t('admin.live.trafficLegend')}</li>
        {traffic.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('h-1.5 w-4 rounded-full', s.cls)} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
