import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Accessibility, EllipsisVertical, ImageOff, LogOut, MapPinOff, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { KeyValue } from '@/components/common/KeyValue'
import { LanguageDropdown } from '@/components/common/LanguageDropdown'
import { PlateChip } from '@/components/common/PlateChip'
import { VehiclePreview } from '@/components/common/VehiclePreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { MobileShell } from '@/components/shell/MobileShell'
import { StickyActionBar } from '@/components/shell/StickyActionBar'
import { TopBar } from '@/components/shell/TopBar'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useErrorText } from '@/hooks/useErrorText'
import { formatDistance, formatPlate, formatRelative, localName } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { confirmParked, flagNotHere, getPhotoUrl, getVisitDetail, markExit } from './api'
import { useNow } from './useNow'
import { useZoneInvalidate } from './useZoneVisits'
import { VisitTimeline } from './VisitTimeline'
import { WrongSlotSheet } from './WrongSlotSheet'
import { useSosNotifier } from '@/hooks/useSosNotifier'
import { SosEmergencyBanner } from '@/components/common/SosEmergencyBanner'

const CONFIRMABLE = new Set(['assigned', 'en_route', 'driver_parked'])

/** Zone vehicle detail `/zone/visit/:id` (docs/07 section 4.2). */
export function ZoneVisitPage() {
  const { t, i18n } = useTranslation(['zone', 'common'])
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { session, role } = useAuth()
  const errorText = useErrorText()
  const invalidate = useZoneInvalidate()
  const now = useNow()
  const [photoOpen, setPhotoOpen] = useState(false)
  const [wrongOpen, setWrongOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)

  const detail = useQuery({ queryKey: queryKeys.visitDetail(id), queryFn: () => getVisitDetail(id), enabled: Boolean(id) })
  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: queryKeys.visitDetail(id) }), [qc, id])
  useRealtime(['visits', 'alerts'], onChange)

  const photoPath = detail.data?.visit.photo_path ?? null
  const photo = useQuery({
    queryKey: queryKeys.photoUrl(photoPath ?? ''),
    queryFn: () => getPhotoUrl(photoPath ?? ''),
    enabled: Boolean(photoPath),
    staleTime: Infinity,
  })

  const visit = detail.data?.visit
  const eventId = visit?.event_id ?? null

  const { openSosAlerts } = useSosNotifier({
    eventId,
    role: 'zone_volunteer',
  })

  const confirm = useMutation({
    mutationFn: () => confirmParked({ visitId: id }),
    onSuccess: () => {
      toast.success(t('zone.confirmedToast'))
      invalidate(eventId, id)
      void navigate('/zone')
    },
    onError: (err) => toast.error(errorText(err)),
  })
  const notHere = useMutation({
    mutationFn: () => flagNotHere(id),
    onSuccess: () => {
      toast.success(t('zone.notHereToast'))
      invalidate(eventId, id)
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const title = detail.data?.slot?.label ?? (visit ? formatPlate(visit.plate) : '')

  const menu =
    visit && (visit.status === 'assigned' || visit.status === 'en_route' || visit.status === 'confirmed') ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('zone.moreActions')}
            className="inline-flex size-11 items-center justify-center rounded-md text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
          >
            <EllipsisVertical size={24} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {visit.status === 'confirmed' ? (
            <DropdownMenuItem onSelect={() => setExitOpen(true)}>
              <LogOut strokeWidth={1.75} aria-hidden="true" />
              {t('zone.markExit')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => notHere.mutate()}>
              <MapPinOff strokeWidth={1.75} aria-hidden="true" />
              {t('zone.notHere')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  const topBar = (
    <TopBar
      back="/zone"
      title={title}
      trailing={
        <>
          <LanguageDropdown />
          {menu}
        </>
      }
    />
  )

  if (detail.isLoading) {
    return (
      <MobileShell topBar={topBar}>
        <Skeleton className="aspect-4/3 w-full rounded-lg" />
        <Skeleton className="h-13 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </MobileShell>
    )
  }
  if (detail.error) {
    const code = (detail.error as { code?: string }).code
    return (
      <MobileShell topBar={topBar}>
        {code === 'NOT_FOUND' || code === 'FORBIDDEN' ? (
          <EmptyState title={t('zone.detail.notFound')} />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        )}
      </MobileShell>
    )
  }
  if (!visit || !detail.data) return null

  const d = detail.data
  const TypeIcon = vehicleTypeIcon[visit.vehicle_type]
  const canConfirm = CONFIRMABLE.has(visit.status)
  const ownZones = role === 'admin' ? (d.zone ? [d.zone.id] : []) : session?.zoneIds ?? []

  return (
    <MobileShell
      topBar={topBar}
      actionBar={
        canConfirm ? (
          <StickyActionBar row>
            <Button variant="secondary" size="lg" onClick={() => setWrongOpen(true)}>
              {t('zone.wrongSlot')}
            </Button>
            <Button size="lg" loading={confirm.isPending} onClick={() => confirm.mutate()}>
              {t('zone.confirm')}
            </Button>
          </StickyActionBar>
        ) : undefined
      }
    >
      <SosEmergencyBanner
        alerts={openSosAlerts}
        role="zone_volunteer"
        className="-mx-4 -mt-4 mb-4 sm:-mx-6 sm:-mt-6"
      />
      {photoPath ? (
        <button
          type="button"
          onClick={() => setPhotoOpen(true)}
          aria-label={t('zone.detail.enlarge')}
          className="-mx-4 block overflow-hidden bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-focus sm:mx-0 sm:rounded-lg"
        >
          {photo.data ? (
            <img src={photo.data} alt={t('zone.detail.photo')} className="aspect-4/3 w-full object-cover" />
          ) : (
            <Skeleton className="aspect-4/3 w-full rounded-none" />
          )}
        </button>
      ) : (
        <div className="flex h-20 items-center justify-center gap-2 rounded-lg bg-surface-2 text-muted">
          <ImageOff size={24} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-body">{t('zone.detail.noPhoto')}</span>
        </div>
      )}

      <VehiclePreview
        vehicleType={visit.vehicle_type}
        color={visit.vehicle_color}
        make={visit.vehicle_make}
        plate={visit.plate}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlateChip plate={visit.plate} size="lg" />
        <StatusBadge status={visit.status} vehicleType={visit.vehicle_type} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-ink">
          <span className="inline-flex items-center gap-1.5">
            <TypeIcon size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
            {t(`common.enums.vehicleType.${visit.vehicle_type}`)}
          </span>
          {visit.vehicle_color ? <span className="capitalize">{visit.vehicle_color}</span> : null}
          {visit.vehicle_make ? <span>{visit.vehicle_make}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted">
          <span>{t(`common.enums.category.${visit.category}`)}</span>
          {visit.needs_accessible ? (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Accessibility size={20} strokeWidth={1.75} aria-hidden="true" />
              {t('zone.detail.accessible')}
            </span>
          ) : null}
          {d.zone ? <span>{localName(d.zone, i18n.language)}</span> : null}
        </div>
      </div>

      <dl className="rounded-lg border border-line bg-surface px-4">
        {d.driver ? (
          <KeyValue label={t('zone.detail.phone')} value={<span className="tabular-nums">{d.driver.phone_masked}</span>} />
        ) : null}
        <KeyValue
          label={t('zone.detail.driver')}
          value={
            visit.driver_parked_at
              ? visit.driver_parked_distance_m !== null
                ? t('zone.detail.driverParked', {
                    time: formatRelative(visit.driver_parked_at, t, now),
                    distance: formatDistance(visit.driver_parked_distance_m),
                  })
                : t('zone.detail.driverParkedNoLocation', { time: formatRelative(visit.driver_parked_at, t, now) })
              : t('zone.detail.driverNotParked')
          }
        />
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-h3 text-ink">{t('zone.detail.timeline')}</h2>
        <VisitTimeline events={d.events} />
      </section>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent hideClose className="max-w-3xl gap-2 p-2 lg:p-2">
          <DialogTitle className="sr-only">{t('zone.detail.photo')}</DialogTitle>
          {photo.data ? <img src={photo.data} alt={t('zone.detail.photo')} className="w-full rounded-md" /> : null}
          <Button variant="secondary" icon={<X size={20} strokeWidth={1.75} aria-hidden="true" />} onClick={() => setPhotoOpen(false)}>
            {t('zone.detail.closePhoto')}
          </Button>
        </DialogContent>
      </Dialog>

      {eventId ? (
        <WrongSlotSheet
          open={wrongOpen}
          onOpenChange={setWrongOpen}
          eventId={eventId}
          zoneIds={ownZones}
          visit={{
            id: visit.id,
            plate: visit.plate,
            vehicle_type: visit.vehicle_type,
            slot_id: visit.slot_id,
            slot_label: d.slot?.label ?? null,
          }}
          onDone={() => void navigate('/zone')}
        />
      ) : null}

      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={t('zone.exitDialog.title', { plate: formatPlate(visit.plate) })}
        description={d.slot ? t('zone.exitDialog.body', { slot: d.slot.label }) : undefined}
        confirmLabel={t('zone.exitDialog.confirm')}
        onConfirm={async () => {
          try {
            await markExit(visit.id)
            toast.success(t('zone.exitToast'))
            invalidate(eventId, visit.id)
            void navigate('/zone')
          } catch (err) {
            toast.error(errorText(err))
            throw err
          }
        }}
      />
    </MobileShell>
  )
}
