import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleCheck, Hourglass, Menu, Navigation } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/Drawer'
import { DRAWER_SNAPS, SNAP_HALF } from '@/components/ui/drawerSnaps'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { PlateChip } from '@/components/common/PlateChip'
import { SlotLabel } from '@/components/common/SlotLabel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { IconButton } from '@/components/shell/IconButton'
import { MobileShell } from '@/components/shell/MobileShell'
import { TopBar } from '@/components/shell/TopBar'
import { BaseMap } from '@/features/map/BaseMap'
import { UserPuck } from '@/features/map/UserPuck'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { formatDistance, localName } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import type { DriverVisit } from '@/types/domain'
import { acceptLocationConsent, startNavigation } from './api'
import { ConsentView } from './ConsentView'
import { DriverMenuSheet } from './DriverMenuSheet'
import { distanceToSlot, driverFitBox } from './driverMap'
import { useDriverPrefs } from './driverPrefs'
import { FitControls } from './FitControls'
import { LocationHelpSheet } from './LocationHelpSheet'
import { MarkParkedDialog } from './MarkParkedDialog'
import { SosButton } from './SosButton'
import { SosSheet } from './SosSheet'
import { useLiveLocation } from './useLiveLocation'
import { useMarkParked } from './useMarkParked'
import { useMyVisit } from './useMyVisit'
import { isSharingStatus, usePositionSharing } from './usePositionSharing'

/** Driver home "Your parking" (docs/07 section 2.2) with the consent state (2.1). */
export function DriverHomePage() {
  const { t } = useTranslation('driver')
  const visitQuery = useMyVisit()
  const qc = useQueryClient()
  const errorText = useErrorText()
  const consentSkipped = useDriverPrefs((s) => s.consentSkipped)
  const skipConsent = useDriverPrefs((s) => s.skipConsent)
  const [sosOpen, setSosOpen] = useState(false)

  const consent = useMutation({
    mutationFn: acceptLocationConsent,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.myVisit() }),
    onError: (err) => toast.error(errorText(err)),
  })

  const visit = visitQuery.data

  if (visitQuery.isLoading) return <DriverHomeSkeleton />
  if (visitQuery.isError || !visit) {
    return (
      <MobileShell topBar={<TopBar title={t('driver.title')} />}>
        {visitQuery.isError ? (
          <ErrorState error={visitQuery.error} onRetry={() => void visitQuery.refetch()} retrying={visitQuery.isFetching} />
        ) : (
          <EmptyState title={t('driver.noVisit.title')} description={t('driver.noVisit.body')} />
        )}
      </MobileShell>
    )
  }

  const active = isSharingStatus(visit.visit.status)
  const needsConsent = active && !visit.driver.location_consent_at && !consentSkipped

  return (
    <>
      {needsConsent ? (
        <ConsentView
          visit={visit}
          allowing={consent.isPending}
          onAllow={() => consent.mutate()}
          onSkip={skipConsent}
          onSos={() => setSosOpen(true)}
        />
      ) : (
        <DriverHomeMap visit={visit} onSos={() => setSosOpen(true)} />
      )}
      <SosSheet
        open={sosOpen}
        onOpenChange={setSosOpen}
        emergencyPhone={visit.event.emergency_phone}
        alreadyOpen={visit.open_sos}
      />
    </>
  )
}

function DriverHomeSkeleton() {
  return (
    <div className="relative h-app overflow-hidden bg-surface-2" aria-busy="true">
      <div className="absolute inset-x-0 bottom-0 flex h-1/2 flex-col gap-3 rounded-t-xl border-t border-line bg-surface p-4">
        <Skeleton className="mx-auto h-1 w-9" />
        <Skeleton className="h-15 w-40" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="mt-auto h-13 w-full" />
      </div>
    </div>
  )
}

type DriverHomeMapProps = { visit: DriverVisit; onSos: () => void }

function DriverHomeMap({ visit, onSos }: DriverHomeMapProps) {
  const { t, i18n } = useTranslation('driver')
  const navigate = useNavigate()
  const routerLocation = useLocation()
  const qc = useQueryClient()
  const errorText = useErrorText()
  const lang = i18n.language
  const status = visit.visit.status
  const active = isSharingStatus(status)
  const consented = Boolean(visit.driver.location_consent_at)

  const { eventMap, error: mapError, refetch: refetchMap } = useMapData(visit.event.id, { withStatuses: false })
  const { status: locStatus, fix } = useLiveLocation({ enabled: consented && active })
  usePositionSharing(visit, fix)

  const [snap, setSnap] = useState<number | string | null>(SNAP_HALF)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [parkOpen, setParkOpen] = useState(false)
  const [changedTo, setChangedTo] = useState<string | null>(null)
  const mismatchFor = useDriverPrefs((s) => s.mismatchFor)
  const cameFromDenied = Boolean((routerLocation.state as { locationOff?: boolean } | null)?.locationOff)
  const locationOff = locStatus === 'denied' || cameFromDenied

  // Reassignment: the slot id changes through realtime.
  const slotId = visit.slot?.id ?? null
  const slotLabel = visit.slot?.label ?? ''
  const prevSlot = useRef(slotId)
  useEffect(() => {
    if (prevSlot.current && slotId && prevSlot.current !== slotId) {
      setChangedTo(slotLabel)
      toast(t('driver.slotChanged', { slot: slotLabel }))
    }
    prevSlot.current = slotId
  }, [slotId, slotLabel, t])

  const markParked = useMarkParked(visit.visit.id, fix)

  const start = useMutation({
    mutationFn: async () => {
      if (!consented) {
        await acceptLocationConsent()
        await qc.invalidateQueries({ queryKey: queryKeys.myVisit() })
      }
      await startNavigation()
    },
    onSuccess: () => navigate('/driver/navigate'),
    onError: (err) => toast.error(errorText(err)),
  })

  // The camera box only changes with the slot (or when the user first gets a fix), not on every fix.
  const hasFix = fix !== null
  const box = useMemo(() => driverFitBox(visit, fix), [slotId, hasFix]) // eslint-disable-line react-hooks/exhaustive-deps
  const vh = typeof window === 'undefined' ? 740 : window.innerHeight
  const padding = { top: 80, bottom: Math.round(vh * 0.5) + 16, left: 40, right: 64 }
  const distance = distanceToSlot(visit, fix)

  return (
    <div className="relative h-app overflow-hidden bg-surface-2">
      <div className="absolute inset-0">
        {eventMap ? (
          <BaseMap
            eventMap={eventMap}
            baseLayer={eventMap.event.base_map}
            slotPaint="neutral"
            highlightSlotId={slotId ?? undefined}
            pulseHighlight
            fitTo={box ? { bbox: box } : 'event'}
            fitPadding={padding}
            ariaLabel={t('driver.mapLabel')}
          >
            <UserPuck fix={fix} />
            <FitControls box={box} padding={padding} className="top-20" />
          </BaseMap>
        ) : mapError ? (
          <div className="flex h-1/2 items-center p-4 pt-20">
            <ErrorState error={mapError} onRetry={refetchMap} className="w-full" />
          </div>
        ) : null}
      </div>

      <TopBar
        transparent
        title={t('driver.title')}
        leading={
          <IconButton
            tone="float"
            label={t('driver.menu.open')}
            onClick={() => setMenuOpen(true)}
            icon={<Menu size={24} strokeWidth={1.75} aria-hidden="true" />}
          />
        }
        trailing={<SosButton onClick={onSos} />}
      />
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 pt-safe">
        <OfflineBanner />
      </div>

      <Drawer
        open
        modal={false}
        dismissible={false}
        snapPoints={DRAWER_SNAPS}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
      >
        <DrawerContent noOverlay className="h-full max-h-11/12 z-40" aria-describedby={undefined}>
          <DrawerTitle className="sr-only">{t('driver.title')}</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2 pb-6">
            {changedTo ? (
              <Alert tone="info" className="animate-fade-in">
                <span className="font-semibold">{t('driver.slotChanged', { slot: changedTo })}</span>
              </Alert>
            ) : null}

            {status === 'exited' || status === 'cancelled' ? (
              <EmptyState
                className="py-6"
                title={status === 'exited' ? t('driver.visitEnded') : t('driver.visitCancelled')}
              />
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  {visit.slot ? (
                    <SlotLabel
                      size="xl"
                      label={visit.slot.label}
                      zoneColor={visit.zone?.color}
                      zoneName={visit.zone ? localName(visit.zone, lang) : null}
                      accessible={visit.slot.is_accessible}
                    />
                  ) : null}
                  <StatusBadge status={status} vehicleType={visit.visit.vehicle_type} className="mt-2 shrink-0" />
                </div>
                <PlateChip plate={visit.visit.plate} size="md" className="self-start" />
                {distance !== null || visit.landmark ? (
                  <div className="flex flex-col gap-0.5 text-body text-muted">
                    {distance !== null && active ? (
                      <span className="tabular-nums">{t('driver.fromYou', { distance: formatDistance(distance) })}</span>
                    ) : null}
                    {visit.landmark ? <span>{t('driver.near', { place: localName(visit.landmark, lang) })}</span> : null}
                  </div>
                ) : null}

                {status === 'driver_parked' ? (
                  <InfoRow tone="waiting" text={t('driver.waitingCheck')} />
                ) : status === 'confirmed' ? (
                  <InfoRow tone="success" text={t('driver.confirmed')} />
                ) : null}

                {mismatchFor === visit.visit.id && status === 'driver_parked' ? (
                  <Alert tone="warning">{t('driver.farFromSlot', { slot: slotLabel })}</Alert>
                ) : null}

                {locationOff && active ? (
                  <Alert
                    tone="warning"
                    action={
                      <Button variant="link" size="sm" onClick={() => setHelpOpen(true)}>
                        {t('driver.locationOff.howTo')}
                      </Button>
                    }
                  >
                    {t('driver.locationOff.body')}
                  </Alert>
                ) : null}

                <div className="flex flex-col gap-2">
                  {status === 'assigned' || status === 'en_route' ? (
                    <>
                      <Button
                        size="lg"
                        block
                        loading={start.isPending}
                        icon={<Navigation size={20} strokeWidth={1.75} aria-hidden="true" />}
                        onClick={() => start.mutate()}
                      >
                        {t('driver.startDirections')}
                      </Button>
                      <Button variant="secondary" size="md" block onClick={() => setParkOpen(true)}>
                        {t('driver.markParked')}
                      </Button>
                    </>
                  ) : (
                    <Button size="lg" block onClick={() => navigate('/driver/find')}>
                      {t('driver.findVehicle')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <DriverMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        showSharing={active && consented}
        emergencyPhone={visit.event.emergency_phone}
      />
      <LocationHelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
      <MarkParkedDialog
        open={parkOpen}
        onOpenChange={setParkOpen}
        slotLabel={slotLabel}
        onConfirm={() => markParked.mutateAsync()}
      />
    </div>
  )
}

function InfoRow({ tone, text }: { tone: 'waiting' | 'success'; text: string }) {
  const Icon = tone === 'waiting' ? Hourglass : CircleCheck
  return (
    <div
      role="status"
      className={
        tone === 'waiting'
          ? 'flex items-center gap-3 rounded-md bg-status-waiting-soft px-3 py-3 text-body text-ink'
          : 'flex items-center gap-3 rounded-md bg-success-soft px-3 py-3 text-body text-ink'
      }
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        aria-hidden="true"
        className={tone === 'waiting' ? 'shrink-0 text-warning' : 'shrink-0 text-success'}
      />
      <span>{text}</span>
    </div>
  )
}
