import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { LoaderCircle, LocateFixed, MapPin, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { SlotLabel } from '@/components/common/SlotLabel'
import { MobileShell } from '@/components/shell/MobileShell'
import { TopBar } from '@/components/shell/TopBar'
import { DEMO_MODE } from '@/config/app'
import { BaseMap } from '@/features/map/BaseMap'
import { MapControls } from '@/features/map/MapControls'
import { RouteLayer } from '@/features/map/RouteLayer'
import { UserPuck } from '@/features/map/UserPuck'
import { bboxOfPoints, bufferBbox } from '@/features/map/style/layers'
import { useMapData } from '@/features/map/useMapData'
import { useWakeLock } from '@/hooks/useWakeLock'
import { formatDistance, localName } from '@/lib/format'
import { cachedGraph, findRoute } from '@/lib/geo/routing'
import type { DriverVisit, LngLat } from '@/types/domain'
import { ArrivalSheet } from './ArrivalSheet'
import { distanceToSlotShape } from './driverMap'
import { FollowCamera } from './FollowCamera'
import { InstructionCard } from './InstructionCard'
import { STEP_ICONS, stepText, thenText } from './navText'
import { SimulateDrive } from './SimulateDrive'
import { SosButton } from './SosButton'
import { SosSheet } from './SosSheet'
import { useLiveLocation } from './useLiveLocation'
import { useMarkParked } from './useMarkParked'
import { useMyVisit } from './useMyVisit'
import { usePositionSharing } from './usePositionSharing'
import { useRouteGuidance } from './useRouteGuidance'

/** 10 km/h on campus roads (docs/07 section 2.3). */
const DRIVE_MPS = 10 / 3.6

/** Live navigation to the slot (docs/07 section 2.3, docs/05 section 8.3). */
export function NavigatePage() {
  const { t } = useTranslation('driver')
  const visitQuery = useMyVisit()
  const visit = visitQuery.data

  if (visitQuery.isLoading) {
    return (
      <div className="relative h-app bg-surface-2" aria-busy="true">
        <Skeleton className="absolute inset-x-3 top-3 h-24 bg-surface" />
        <Skeleton className="absolute inset-x-0 bottom-0 h-18 rounded-none bg-surface" />
      </div>
    )
  }
  if (visitQuery.isError) {
    return (
      <MobileShell topBar={<TopBar title={t('driver.title')} back="/driver" />}>
        <ErrorState error={visitQuery.error} onRetry={() => void visitQuery.refetch()} />
      </MobileShell>
    )
  }
  // Navigation only makes sense before parking.
  if (!visit || !visit.slot || (visit.visit.status !== 'assigned' && visit.visit.status !== 'en_route')) {
    return <Navigate to="/driver" replace />
  }
  return <NavigateView visit={visit} />
}

function NavigateView({ visit }: { visit: DriverVisit }) {
  const { t, i18n } = useTranslation('driver')
  const navigate = useNavigate()
  const lang = i18n.language
  const slot = visit.slot
  const { eventMap, error: mapError, refetch } = useMapData(visit.event.id, { withStatuses: false })
  const { status: locStatus, fix } = useLiveLocation({ enabled: true })
  usePositionSharing(visit, fix)
  useWakeLock(true)

  const [follow, setFollow] = useState(true)
  const [sosOpen, setSosOpen] = useState(false)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  const arrivalShown = useRef(false)

  const target: LngLat | null = slot ? slot.center : null
  const gate: LngLat | null = visit.gate?.location ?? null
  const guidance = useRouteGuidance({ eventMap, mode: 'drive', fix, target, gate })
  const markParked = useMarkParked(visit.visit.id, fix)

  // Arrival: within arrival_radius_m of the slot polygon, once per slot.
  const radius = visit.event.arrival_radius_m
  const slotId = slot?.id
  useEffect(() => {
    arrivalShown.current = false
  }, [slotId])
  useEffect(() => {
    if (!fix || arrivalShown.current) return
    const d = distanceToSlotShape(visit, fix)
    if (d !== null && d < radius) {
      arrivalShown.current = true
      setArrivalOpen(true)
    }
  }, [fix, visit, radius])

  const zoneName = visit.zone ? localName(visit.zone, lang) : ''

  // Instruction card content by state.
  let icon: LucideIcon = MapPin
  let rotate = false
  let text: string
  let secondary: string | null = null
  switch (guidance.state) {
    case 'waiting':
      icon = LocateFixed
      text = t('driver.nav.findingLocation')
      break
    case 'offCampus':
      text = t('driver.nav.headToGate')
      secondary = visit.gate ? localName(visit.gate, lang) : null
      break
    case 'noRoute':
      text = t('driver.nav.followVolunteers', { zone: zoneName })
      break
    case 'rerouting':
      icon = LoaderCircle
      text = t('driver.nav.rerouting')
      break
    default: {
      const step = guidance.step
      const d = guidance.stepDistanceM ?? 0
      if (step) {
        icon = STEP_ICONS[step.type].icon
        rotate = STEP_ICONS[step.type].rotate ?? false
        text = stepText(t, step, d)
        secondary = thenText(t, step, d, guidance.nextStep)
      } else {
        text = t('driver.nav.arrived')
      }
    }
  }

  // Map geometry for the current state.
  const route = guidance.route ?? guidance.gateRoute
  const straightLine = useMemo(() => {
    if (guidance.state !== 'noRoute' || !fix || !target) return null
    const line: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[fix.lng, fix.lat], target] },
    }
    return line
  }, [guidance.state, fix, target])
  const legs = useMemo(() => {
    const out: (GeoJSON.Feature<GeoJSON.LineString> | null)[] = []
    if (route) out.push(route.lastLeg, guidance.route ? route.firstLeg : null)
    if (straightLine) out.push(straightLine)
    return out
  }, [route, guidance.route, straightLine])

  const offCampus = guidance.state === 'offCampus'
  const offCampusBox = useMemo(() => {
    if (!offCampus || !target) return null
    const b = bboxOfPoints(gate ? [gate, target] : [target])
    return b ? bufferBbox(b, 60) : null
  }, [offCampus, gate, target])

  const remaining = guidance.remainingM
  const etaMin = remaining !== null ? Math.max(1, Math.round(remaining / DRIVE_MPS / 60)) : null

  // Demo: drive the route from the current fix, or from the entry gate when there is none.
  const buildPath = () => {
    if (guidance.route && fix) {
      const r = guidance.route
      return [[fix.lng, fix.lat], ...r.line.geometry.coordinates, ...r.lastLeg.geometry.coordinates.slice(1)]
    }
    if (!gate || !target || !eventMap) return null
    const graph = cachedGraph(eventMap.roads, 'drive', `${eventMap.event.id}:${eventMap.version}`)
    const r = guidance.gateRoute ?? findRoute(graph, eventMap.roads, gate, target, 'drive')
    if (!r) return [gate, target]
    return [gate, ...r.line.geometry.coordinates, ...r.lastLeg.geometry.coordinates.slice(1)]
  }

  const denied = locStatus === 'denied' || locStatus === 'unavailable'
  if (denied && !DEMO_MODE && !fix) return <Navigate to="/driver" replace state={{ locationOff: true }} />

  const following = follow && guidance.state !== 'offCampus' && fix !== null

  return (
    <div className="relative h-app overflow-hidden bg-surface-2">
      <div className="absolute inset-0">
        {eventMap ? (
          <BaseMap
            eventMap={eventMap}
            baseLayer={eventMap.event.base_map}
            slotPaint="neutral"
            highlightSlotId={slot?.id}
            pulseHighlight
            fitTo={offCampusBox ? { bbox: offCampusBox } : 'event'}
            fitPadding={{ top: 160, bottom: 120, left: 40, right: 64 }}
            onUserMove={() => setFollow(false)}
            ariaLabel={t('driver.mapLabel')}
            attribution={{ position: 'bottom-left', offset: 80 }}
          >
            <RouteLayer line={route?.line ?? null} legs={legs} />
            <UserPuck fix={fix} />
            <FollowCamera fix={fix} enabled={following} />
            <MapControls
              className="bottom-24"
              showZoom={false}
              onRecenter={() => setFollow(true)}
              recenterActive={following}
            />
          </BaseMap>
        ) : mapError ? (
          <div className="p-4 pt-36">
            <ErrorState error={mapError} onRetry={refetch} />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-2 px-3 pt-3 pt-safe">
        <InstructionCard icon={icon} rotateIcon={rotate} text={text} secondary={secondary} className="pointer-events-auto" />
        <OfflineBanner className="rounded-md" />
        {DEMO_MODE ? <SimulateDrive mode="drive" buildPath={buildPath} /> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe">
        <div className="mx-auto flex max-w-160 items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              {slot ? <SlotLabel size="sm" label={slot.label} zoneColor={visit.zone?.color} /> : null}
              <span className="truncate text-body-sm text-muted">{zoneName}</span>
            </div>
            <div className="flex items-center gap-3 text-body-sm text-ink tabular-nums">
              {remaining !== null ? <span className="font-semibold">{formatDistance(remaining)}</span> : null}
              {etaMin !== null ? <span className="text-muted">{t('driver.nav.aboutMin', { count: etaMin })}</span> : null}
            </div>
          </div>
          <SosButton onClick={() => setSosOpen(true)} />
          <Button variant="ghost" size="md" onClick={() => navigate('/driver')}>
            {t('driver.nav.end')}
          </Button>
        </div>
      </div>

      <ArrivalSheet
        open={arrivalOpen}
        onOpenChange={setArrivalOpen}
        slotLabel={slot?.label ?? ''}
        zoneColor={visit.zone?.color ?? null}
        zoneName={zoneName}
        marking={markParked.isPending}
        onMarkParked={() =>
          markParked.mutate(undefined, {
            onSuccess: () => {
              setArrivalOpen(false)
              navigate('/driver')
            },
          })
        }
      />
      <SosSheet
        open={sosOpen}
        onOpenChange={setSosOpen}
        emergencyPhone={visit.event.emergency_phone}
        alreadyOpen={visit.open_sos}
      />
    </div>
  )
}
