import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router'
import { Footprints, LocateFixed, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { PlateChip } from '@/components/common/PlateChip'
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
import { formatDistance, localName } from '@/lib/format'
import { cachedGraph, findRoute } from '@/lib/geo/routing'
import type { DriverVisit, LngLat } from '@/types/domain'
import { FollowCamera } from './FollowCamera'
import { InstructionCard } from './InstructionCard'
import { STEP_ICONS, stepText, thenText } from './navText'
import { SimulateDrive } from './SimulateDrive'
import { SosButton } from './SosButton'
import { SosSheet } from './SosSheet'
import { useLiveLocation } from './useLiveLocation'
import { useMyVisit } from './useMyVisit'
import { usePositionSharing } from './usePositionSharing'
import { useRouteGuidance } from './useRouteGuidance'

/** Walking pace for the ETA (docs/07 section 2.4). */
const WALK_MPS = 1.2

/** Find my vehicle: walking route back to the slot and the nearest landmark (docs/07 section 2.4, docs/05 section 10). */
export function FindVehiclePage() {
  const { t } = useTranslation('driver')
  const visitQuery = useMyVisit()
  const visit = visitQuery.data
  const topBar = <TopBar title={t('driver.findVehicle')} back="/driver" />

  if (visitQuery.isLoading) {
    return (
      <MobileShell topBar={topBar} bleed>
        <Skeleton className="h-72 w-full rounded-none" />
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-15 w-40" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-13 w-full" />
        </div>
      </MobileShell>
    )
  }
  if (visitQuery.isError) {
    return (
      <MobileShell topBar={topBar}>
        <ErrorState error={visitQuery.error} onRetry={() => void visitQuery.refetch()} />
      </MobileShell>
    )
  }
  if (!visit) return <Navigate to="/driver" replace />
  if (!visit.slot) {
    return (
      <MobileShell topBar={topBar}>
        <EmptyState title={t('driver.noVisit.title')} description={t('driver.noVisit.body')} />
      </MobileShell>
    )
  }
  return <FindView visit={visit} />
}

function FindView({ visit }: { visit: DriverVisit }) {
  const { t, i18n } = useTranslation('driver')
  const lang = i18n.language
  const slot = visit.slot
  const consented = Boolean(visit.driver.location_consent_at)
  const { eventMap, error: mapError, refetch } = useMapData(visit.event.id, { withStatuses: false })
  const { fix } = useLiveLocation({ enabled: consented })
  usePositionSharing(visit, fix)
  const [walking, setWalking] = useState(false)
  const [follow, setFollow] = useState(true)
  const [sosOpen, setSosOpen] = useState(false)

  const target: LngLat | null = slot ? slot.center : null
  const guidance = useRouteGuidance({ eventMap, mode: 'walk', fix, target, gate: null })
  const route = guidance.route
  const remaining = guidance.remainingM
  const etaMin = remaining !== null ? Math.max(1, Math.round(remaining / WALK_MPS / 60)) : null

  const box = useMemo(() => {
    if (!target) return null
    const b = bboxOfPoints([target])
    return b ? bufferBbox(b, 60) : null
  }, [target])

  const legs = useMemo(() => (route ? [route.lastLeg, route.firstLeg] : []), [route])
  const zoneName = visit.zone ? localName(visit.zone, lang) : null

  const step = guidance.step
  const d = guidance.stepDistanceM ?? 0
  const card =
    guidance.state === 'waiting'
      ? { icon: LocateFixed, rotate: false, text: t('driver.nav.findingLocation'), secondary: null }
      : guidance.state === 'rerouting'
        ? { icon: LocateFixed, rotate: false, text: t('driver.nav.rerouting'), secondary: null }
        : step
          ? {
              icon: STEP_ICONS[step.type].icon,
              rotate: STEP_ICONS[step.type].rotate ?? false,
              text: stepText(t, step, d),
              secondary: thenText(t, step, d, guidance.nextStep),
            }
          : { icon: MapPin, rotate: false, text: t('driver.find.followMap', { slot: slot?.label ?? '' }), secondary: null }

  const buildPath = () => {
    if (!eventMap || !target) return null
    if (route && fix) return [[fix.lng, fix.lat], ...route.line.geometry.coordinates, ...route.lastLeg.geometry.coordinates.slice(1)]
    // No fix yet: walk in from the entry gate.
    const gate = visit.gate?.location
    if (!gate) return null
    const r = findRoute(cachedGraph(eventMap.roads, 'walk', `${eventMap.event.id}:${eventMap.version}`), eventMap.roads, gate, target, 'walk')
    return r ? [gate, ...r.line.geometry.coordinates, ...r.lastLeg.geometry.coordinates.slice(1)] : [gate, target]
  }

  const following = walking && follow && fix !== null

  return (
    <div className="flex h-app flex-col bg-canvas">
      <TopBar title={t('driver.findVehicle')} back="/driver" trailing={<SosButton onClick={() => setSosOpen(true)} />} />
      <OfflineBanner />
      <div className="relative min-h-60 w-full flex-3">
        {eventMap ? (
          <BaseMap
            eventMap={eventMap}
            baseLayer={eventMap.event.base_map}
            slotPaint="neutral"
            highlightSlotId={slot?.id}
            pulseHighlight
            fitTo={box ? { bbox: box } : 'event'}
            fitPadding={48}
            onUserMove={() => setFollow(false)}
            ariaLabel={t('driver.mapLabel')}
          >
            <RouteLayer line={route?.line ?? null} legs={legs} />
            <UserPuck fix={fix} />
            <FollowCamera fix={fix} enabled={following} />
            <MapControls
              className="top-3"
              showZoom={!walking}
              onRecenter={walking ? () => setFollow(true) : undefined}
              recenterActive={following}
            />
            {walking ? (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-20 pr-14">
                <InstructionCard
                  variant="walk"
                  icon={card.icon}
                  rotateIcon={card.rotate}
                  text={card.text}
                  secondary={card.secondary}
                  className="pointer-events-auto"
                />
              </div>
            ) : null}
            {DEMO_MODE && consented ? (
              <SimulateDrive mode="walk" buildPath={buildPath} className="absolute bottom-3 left-3 z-20" />
            ) : null}
          </BaseMap>
        ) : mapError ? (
          <div className="p-4">
            <ErrorState error={mapError} onRetry={refetch} />
          </div>
        ) : (
          <Skeleton className="size-full rounded-none" />
        )}
      </div>

      <div className="mx-auto flex w-full max-w-160 flex-2 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6 pb-safe">
        {slot ? (
          <SlotLabel
            size="xl"
            label={slot.label}
            zoneColor={visit.zone?.color}
            zoneName={zoneName}
            accessible={slot.is_accessible}
          />
        ) : null}
        <div className="flex flex-col gap-0.5 text-body text-muted">
          {visit.landmark ? <span>{t('driver.near', { place: localName(visit.landmark, lang) })}</span> : null}
          {remaining !== null && etaMin !== null ? (
            <span className="tabular-nums">
              {t('driver.find.walkEta', { distance: formatDistance(remaining), count: etaMin })}
            </span>
          ) : null}
        </div>
        <PlateChip plate={visit.visit.plate} size="md" className="self-start" />
        {walking ? null : (
          <Button
            size="lg"
            block
            className="mt-2"
            icon={<Footprints size={20} strokeWidth={1.75} aria-hidden="true" />}
            disabled={!consented}
            onClick={() => {
              setWalking(true)
              setFollow(true)
            }}
          >
            {t('driver.walkThere')}
          </Button>
        )}
        {!consented ? <p className="text-body-sm text-muted">{t('driver.find.noLocation')}</p> : null}
      </div>

      <SosSheet
        open={sosOpen}
        onOpenChange={setSosOpen}
        emergencyPhone={visit.event.emergency_phone}
        alreadyOpen={visit.open_sos}
      />
    </div>
  )
}
