import { useMutation } from '@tanstack/react-query'
import { EllipsisVertical, LogOut, MapPinOff, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useErrorText } from '@/hooks/useErrorText'
import { formatPlate, formatRelative } from '@/lib/format'
import type { ZoneVisit } from '@/types/domain'
import { confirmParked, flagNotHere, markExit } from './api'
import { useZoneInvalidate } from './useZoneVisits'

export type ZoneTab = 'waiting' | 'coming' | 'parked'

type ZoneVehicleCardProps = {
  visit: ZoneVisit
  tab: ZoneTab
  eventId: string
  now: number
  onWrongSlot: (visit: ZoneVisit) => void
  onReport: (plate: string) => void
}

/** Card actions per tab (docs/07 section 4.1). */
export function ZoneVehicleCard({ visit, tab, eventId, now, onWrongSlot, onReport }: ZoneVehicleCardProps) {
  const { t } = useTranslation(['zone', 'common'])
  const navigate = useNavigate()
  const errorText = useErrorText()
  const invalidate = useZoneInvalidate()
  const [exitOpen, setExitOpen] = useState(false)

  const confirm = useMutation({
    mutationFn: () => confirmParked({ visitId: visit.id }),
    onSuccess: () => {
      toast.success(t('zone.confirmedToast'))
      invalidate(eventId, visit.id)
    },
    onError: (err) => toast.error(errorText(err)),
  })
  const notHere = useMutation({
    mutationFn: () => flagNotHere(visit.id),
    onSuccess: () => {
      toast.success(t('zone.notHereToast'))
      invalidate(eventId, visit.id)
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const rel = (iso: string | null) => (iso ? formatRelative(iso, t, now) : '')
  const time =
    tab === 'waiting'
      ? t('zone.time.markedParked', { time: rel(visit.driver_parked_at) })
      : tab === 'parked'
        ? t('zone.time.confirmed', { time: rel(visit.confirmed_at) })
        : t('zone.time.assigned', { time: rel(visit.assigned_at) })

  const badges = visit.open_alert_types.length ? (
    <>
      {[...new Set(visit.open_alert_types)].map((a) => (
        <Badge key={a} tone={a === 'sos' ? 'danger' : 'warning'}>
          {a === 'not_arrived' || a === 'confirm_pending' ? (
            <MapPinOff aria-hidden="true" strokeWidth={1.75} />
          ) : (
            <TriangleAlert aria-hidden="true" strokeWidth={1.75} />
          )}
          {t(`zone.alertBadge.${a}`)}
        </Badge>
      ))}
    </>
  ) : null

  const menuTrigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        aria-label={t('zone.moreActions')}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
      >
        <EllipsisVertical size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
  )

  const menu =
    tab === 'coming' ? (
      <DropdownMenu>
        {menuTrigger}
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => notHere.mutate()}>
            <MapPinOff strokeWidth={1.75} aria-hidden="true" />
            {t('zone.notHere')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : tab === 'parked' ? (
      <DropdownMenu>
        {menuTrigger}
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setExitOpen(true)}>
            <LogOut strokeWidth={1.75} aria-hidden="true" />
            {t('zone.markExit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onReport(visit.plate)}>
            <TriangleAlert strokeWidth={1.75} aria-hidden="true" />
            {t('zone.report')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : undefined

  const actions =
    tab === 'waiting' ? (
      <>
        <Button variant="secondary" size="md" onClick={() => onWrongSlot(visit)}>
          {t('zone.wrongSlot')}
        </Button>
        <Button size="md" loading={confirm.isPending} onClick={() => confirm.mutate()}>
          {t('zone.confirm')}
        </Button>
      </>
    ) : tab === 'coming' ? (
      <Button variant="secondary" size="md" loading={confirm.isPending} onClick={() => confirm.mutate()}>
        {t('zone.confirmParked')}
      </Button>
    ) : undefined

  return (
    <>
      <VehicleCard
        plate={visit.plate}
        status={visit.status}
        vehicleType={visit.vehicle_type}
        color={visit.vehicle_color}
        make={visit.vehicle_make}
        category={visit.category}
        slotLabel={visit.slot_label}
        time={time}
        badges={badges}
        menu={menu}
        actions={actions}
        onClick={() => void navigate(`/zone/visit/${visit.id}`)}
      />
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={t('zone.exitDialog.title', { plate: formatPlate(visit.plate) })}
        description={visit.slot_label ? t('zone.exitDialog.body', { slot: visit.slot_label }) : undefined}
        confirmLabel={t('zone.exitDialog.confirm')}
        onConfirm={async () => {
          try {
            await markExit(visit.id)
            toast.success(t('zone.exitToast'))
            invalidate(eventId, visit.id)
          } catch (err) {
            toast.error(errorText(err))
            throw err
          }
        }}
      />
    </>
  )
}
