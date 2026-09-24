import { ChevronDown, List, Map as MapIcon, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { KpiStrip } from '@/components/common/KpiStrip'
import { MobileShell } from '@/components/shell/MobileShell'
import { TopBar } from '@/components/shell/TopBar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useMapData } from '@/features/map/useMapData'
import { useAuth } from '@/hooks/useAuth'
import { useCurrentEvent } from '@/hooks/useCurrentEvent'
import { formatPlate, localName } from '@/lib/format'
import { normalizePlate } from '@/lib/plate'
import { cn } from '@/lib/utils'
import type { ZoneVisit } from '@/types/domain'
import { ReportParkingSheet } from './ReportParkingSheet'
import { StaffMenu } from './StaffMenu'
import { useNow } from './useNow'
import { useZoneVisits } from './useZoneVisits'
import { WrongSlotSheet } from './WrongSlotSheet'
import { ZoneMapView } from './ZoneMapView'
import { ZoneVehicleCard, type ZoneTab } from './ZoneVehicleCard'

const ZONE_KEY = 'eventpark.zone'

function readStoredZone(): string | null {
  try {
    return sessionStorage.getItem(ZONE_KEY)
  } catch {
    return null
  }
}

const byTime = (key: 'assigned_at' | 'driver_parked_at' | 'confirmed_at', dir: 1 | -1) => (a: ZoneVisit, b: ZoneVisit) =>
  dir * (a[key] ?? '').localeCompare(b[key] ?? '')

/** Zone vehicles `/zone` (docs/07 section 4.1, F-ZONE-01, 02, 03, 08). */
export function ZoneHomePage() {
  const { t, i18n } = useTranslation(['zone', 'common'])
  const { session, role } = useAuth()
  const { event, isLoading: eventLoading, error: eventError, refetch: refetchEvent } = useCurrentEvent()
  const eventId = event?.id ?? null
  const { eventMap, slotStatuses, slotRows, isLoading: mapLoading } = useMapData(eventId)
  const now = useNow()

  const allowedZones = useMemo(() => {
    const zones = eventMap?.zones.features ?? []
    const own = role === 'admin' ? null : new Set(session?.zoneIds ?? [])
    return zones
      .filter((z) => !own || own.has(String(z.id)))
      .map((z) => ({ id: String(z.id), code: z.properties.code, name: localName(z.properties, i18n.language) }))
  }, [eventMap, role, session?.zoneIds, i18n.language])

  const [zoneId, setZoneId] = useState<string | null>(readStoredZone)
  const activeZone = allowedZones.find((z) => z.id === zoneId) ?? allowedZones[0] ?? null
  const zoneIds = useMemo(() => (activeZone ? [activeZone.id] : []), [activeZone])

  const visitsQuery = useZoneVisits(zoneIds, Boolean(eventId))
  const visits = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data])

  const [view, setView] = useState<'list' | 'map'>('list')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<ZoneTab | null>(null)
  const [wrongSlotVisit, setWrongSlotVisit] = useState<ZoneVisit | null>(null)
  const [report, setReport] = useState<{ open: boolean; plate: string | null }>({ open: false, plate: null })

  const groups = useMemo(() => {
    const waiting = visits.filter((v) => v.status === 'driver_parked').sort(byTime('driver_parked_at', 1))
    const coming = visits.filter((v) => v.status === 'assigned' || v.status === 'en_route').sort(byTime('assigned_at', 1))
    const parked = visits.filter((v) => v.status === 'confirmed').sort(byTime('confirmed_at', -1))
    return { waiting, coming, parked }
  }, [visits])

  // New vehicle in Waiting: toast and a short vibration (docs/07 section 4.1).
  const seenWaiting = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!visitsQuery.isSuccess) return
    const ids = new Set(groups.waiting.map((v) => v.id))
    const seen = seenWaiting.current
    if (seen) {
      const fresh = groups.waiting.filter((v) => !seen.has(v.id))
      for (const v of fresh) {
        toast(t('zone.newWaiting', { plate: formatPlate(v.plate), slot: v.slot_label ?? '' }))
      }
      if (fresh.length > 0 && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(120)
        } catch {
          /* vibration not allowed */
        }
      }
    }
    seenWaiting.current = ids
  }, [groups.waiting, visitsQuery.isSuccess, t])

  const freeCount = useMemo(() => {
    if (!eventMap || !slotRows || !activeZone) return 0
    const inZone = new Set(eventMap.slots.features.filter((f) => f.properties.zone_id === activeZone.id).map((f) => String(f.id)))
    return slotRows.filter((r) => r.status === 'available' && inZone.has(r.id)).length
  }, [eventMap, slotRows, activeZone])

  const selectZone = (id: string) => {
    setZoneId(id)
    setTab(null)
    seenWaiting.current = null
    try {
      sessionStorage.setItem(ZONE_KEY, id)
    } catch {
      /* storage blocked */
    }
  }

  const q = normalizePlate(query)
  const filter = (list: ZoneVisit[]) => (q ? list.filter((v) => v.plate.includes(q)) : list)

  const title = activeZone ? `${activeZone.code}  ${activeZone.name}` : t('zone.title')
  const zoneSwitcher =
    allowedZones.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('zone.switchZone')}
            className="flex min-h-11 min-w-0 items-center gap-1 rounded-md px-2 text-left outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-h3 text-ink">{title}</span>
              {event ? <span className="truncate text-body-sm text-muted">{event.name}</span> : null}
            </span>
            <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {allowedZones.map((z) => (
            <DropdownMenuItem key={z.id} onSelect={() => selectZone(z.id)} className={cn(z.id === activeZone?.id && 'text-primary')}>
              <span className="font-display text-body font-bold">{z.code}</span>
              {z.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  const topBar = (
    <TopBar
      leading={zoneSwitcher ?? undefined}
      title={zoneSwitcher ? undefined : title}
      subtitle={zoneSwitcher ? undefined : event?.name}
      trailing={<StaffMenu />}
    />
  )

  if (eventLoading) {
    return (
      <MobileShell topBar={topBar}>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-36 w-full rounded-lg" />
        <Skeleton className="h-36 w-full rounded-lg" />
      </MobileShell>
    )
  }
  if (eventError) {
    return (
      <MobileShell topBar={topBar}>
        <ErrorState error={eventError} onRetry={refetchEvent} />
      </MobileShell>
    )
  }
  if (!event) {
    return (
      <MobileShell topBar={topBar}>
        <EmptyState title={t('common.noLiveEvent')} description={t('common.noLiveEventBody')} />
      </MobileShell>
    )
  }
  if (!mapLoading && eventMap && allowedZones.length === 0) {
    return (
      <MobileShell topBar={topBar}>
        <EmptyState title={t('zone.noZones')} description={t('zone.noZonesBody')} />
      </MobileShell>
    )
  }

  const loading = mapLoading || visitsQuery.isLoading
  const tabValue: ZoneTab = tab ?? (groups.waiting.length > 0 ? 'waiting' : 'coming')
  const tabs: { key: ZoneTab; list: ZoneVisit[] }[] = [
    { key: 'waiting', list: groups.waiting },
    { key: 'coming', list: groups.coming },
    { key: 'parked', list: groups.parked },
  ]

  return (
    <MobileShell topBar={topBar} contentClassName="pb-28">
      <KpiStrip
        size="compact"
        items={[
          { key: 'free', label: t('zone.counters.free'), value: loading ? '' : freeCount, tone: 'success' },
          { key: 'coming', label: t('zone.counters.coming'), value: loading ? '' : groups.coming.length, onClick: () => setTab('coming') },
          {
            key: 'waiting',
            label: t('zone.counters.waiting'),
            value: loading ? '' : groups.waiting.length,
            tone: groups.waiting.length > 0 ? 'warning' : 'default',
            onClick: () => setTab('waiting'),
          },
          { key: 'parked', label: t('zone.counters.parked'), value: loading ? '' : groups.parked.length, onClick: () => setTab('parked') },
        ]}
      />

      <SegmentedControl<'list' | 'map'>
        ariaLabel={t('zone.view.label')}
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: t('zone.view.list'), icon: <List size={20} strokeWidth={1.75} aria-hidden="true" /> },
          { value: 'map', label: t('zone.view.map'), icon: <MapIcon size={20} strokeWidth={1.75} aria-hidden="true" /> },
        ]}
      />

      {visitsQuery.error ? <ErrorState error={visitsQuery.error} onRetry={() => void visitsQuery.refetch()} /> : null}

      {view === 'map' ? (
        <ZoneMapView eventMap={eventMap} slotStatuses={slotStatuses} zoneIds={zoneIds} visits={visits} />
      ) : (
        <>
          <div className="relative">
            <Search
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('zone.searchPlaceholder')}
              aria-label={t('zone.searchLabel')}
              autoCapitalize="characters"
              autoComplete="off"
              className="pl-10"
            />
          </div>

          <Tabs value={tabValue} onValueChange={(v) => setTab(v as ZoneTab)} className="flex flex-col gap-3">
            <TabsList className="-mx-4 w-auto px-2 sm:mx-0 sm:px-0">
              {tabs.map(({ key, list }) => (
                <TabsTrigger key={key} value={key} className="min-w-0 flex-1 shrink gap-1.5 px-1.5 text-body-sm sm:px-3 sm:text-body">
                  <span className="truncate">{t(`zone.tabs.${key}`)}</span>
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5 text-caption tabular-nums',
                      key === 'waiting' && list.length > 0 ? 'bg-status-waiting-soft text-warning' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {list.length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map(({ key, list }) => {
              const shown = filter(list)
              return (
                <TabsContent key={key} value={key} className="flex flex-col gap-3">
                  {loading ? (
                    <>
                      <Skeleton className="h-40 w-full rounded-lg" />
                      <Skeleton className="h-40 w-full rounded-lg" />
                    </>
                  ) : shown.length === 0 ? (
                    <EmptyState title={q ? t('zone.empty.search') : t(`zone.empty.${key}`)} />
                  ) : (
                    shown.map((v) => (
                      <ZoneVehicleCard
                        key={v.id}
                        visit={v}
                        tab={key}
                        eventId={event.id}
                        now={now}
                        onWrongSlot={setWrongSlotVisit}
                        onReport={(plate) => setReport({ open: true, plate })}
                      />
                    ))
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 pb-safe">
        <div className="mx-auto flex w-full max-w-160 justify-end px-4 pb-6">
          <button
            type="button"
            aria-label={t('zone.fab')}
            title={t('zone.fab')}
            onClick={() => setReport({ open: true, plate: null })}
            className="pointer-events-auto inline-flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-overlay outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <TriangleAlert size={24} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <WrongSlotSheet
        open={Boolean(wrongSlotVisit)}
        onOpenChange={(o) => !o && setWrongSlotVisit(null)}
        eventId={event.id}
        zoneIds={role === 'admin' ? allowedZones.map((z) => z.id) : session?.zoneIds ?? []}
        visit={wrongSlotVisit}
      />
      <ReportParkingSheet
        key={report.plate ?? 'none'}
        open={report.open}
        onOpenChange={(o) => setReport((r) => ({ ...r, open: o }))}
        eventId={event.id}
        plate={report.plate}
      />
    </MobileShell>
  )
}
