import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeftRight, LogOut, Phone, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { PlateChip } from '@/components/common/PlateChip'
import { VehiclePreview } from '@/components/common/VehiclePreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useErrorText } from '@/hooks/useErrorText'
import { formatClock, formatPlate, localName } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { isActiveStatus } from '@/types/domain'
import { cancelVisit, getVisitDetail, markExit, resendDriverLink } from './api'
import { ChangeSlotSheet } from './ChangeSlotSheet'

type VehicleActionSheetProps = {
  visitId: string | null
  onOpenChange: (open: boolean) => void
  eventId: string
  gateId: string | null
}

/** Vehicle action sheet (docs/07 section 3.5): details, timeline, resend, change slot, mark exit, cancel. */
export function VehicleActionSheet({ visitId, onOpenChange, eventId, gateId }: VehicleActionSheetProps) {
  const { t, i18n } = useTranslation('gate')
  const qc = useQueryClient()
  const errorText = useErrorText()
  const { role } = useAuth()
  const [exitOpen, setExitOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [reason, setReason] = useState('')

  const detail = useQuery({
    queryKey: queryKeys.visitDetail(visitId ?? ''),
    queryFn: () => getVisitDetail(visitId ?? ''),
    enabled: Boolean(visitId),
  })
  useRealtime(['visits', 'whatsapp_messages'], () => {
    if (visitId) void qc.invalidateQueries({ queryKey: queryKeys.visitDetail(visitId) })
  })

  const d = detail.data
  const v = d?.visit

  const refreshLists = () => {
    void qc.invalidateQueries({ queryKey: ['searchVisits'] })
    void qc.invalidateQueries({ queryKey: ['gateOverview'] })
    if (visitId) void qc.invalidateQueries({ queryKey: queryKeys.visitDetail(visitId) })
  }

  const resend = useMutation({
    mutationFn: () => resendDriverLink(visitId ?? ''),
    onSuccess: () => {
      toast.success(t('gate.vehicle.linkSent'))
      refreshLists()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const doExit = async () => {
    if (!v) return
    try {
      await markExit(v.id, gateId)
      toast.success(t('gate.exit.marked'))
      refreshLists()
    } catch (err) {
      toast.error(errorText(err))
      throw err
    }
  }

  const doCancel = async () => {
    if (!v) return
    try {
      await cancelVisit(v.id, reason.trim())
      toast.success(t('gate.vehicle.cancelled'))
      setReason('')
      refreshLists()
    } catch (err) {
      toast.error(errorText(err))
      throw err
    }
  }

  const active = v ? isActiveStatus(v.status) : false
  const canCancel = v ? v.status === 'assigned' || v.status === 'en_route' : false
  const canChange = v ? active && (v.status !== 'confirmed' || role === 'admin') : false
  const lang = i18n.language
  const plateText = v ? formatPlate(v.plate) : ''

  return (
    <>
      <Drawer open={Boolean(visitId)} onOpenChange={onOpenChange}>
        <DrawerContent className="h-11/12" aria-describedby={undefined}>
          <DrawerHeader className="gap-3">
            <DrawerTitle className="sr-only">{t('gate.vehicle.title')}</DrawerTitle>
            {v ? (
              <div className="flex flex-col gap-3 w-full">
                <VehiclePreview vehicleType={v.vehicle_type} color={v.vehicle_color} make={v.vehicle_make} plate={v.plate} />
                <PlateChip plate={v.plate} size="lg" className="self-start" />
              </div>
            ) : (
              <Skeleton className="h-13 w-56" />
            )}
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            {detail.isError ? (
              <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
            ) : !d || !v ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <StatusBadge status={v.status} vehicleType={v.vehicle_type} />
                  {d.slot ? (
                    <span className="font-display text-h3 font-bold text-ink tabular-nums">
                      {t('common.slotLabel', { label: d.slot.label })}
                    </span>
                  ) : null}
                  {d.zone ? <span className="text-body text-muted">{localName(d.zone, lang)}</span> : null}
                </div>
                {d.driver ? (
                  <a
                    href={`tel:${d.driver.phone}`}
                    className="flex min-h-11 items-center gap-2 self-start rounded-md text-body text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Phone size={20} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
                    <span className="tabular-nums">{formatPhone(d.driver.phone)}</span>
                    {d.driver.name ? <span className="text-muted">{d.driver.name}</span> : null}
                  </a>
                ) : null}
                <p className="text-body text-muted">
                  {d.entry_gate
                    ? t('gate.vehicle.checkedInAt', { time: formatClock(v.checked_in_at), gate: d.entry_gate.name })
                    : t('gate.vehicle.checkedIn', { time: formatClock(v.checked_in_at) })}
                </p>
                {d.events.length > 0 ? (
                  <section className="flex flex-col gap-2" aria-labelledby="vehicle-timeline">
                    <h3 id="vehicle-timeline" className="text-body-sm font-semibold text-ink">
                      {t('gate.vehicle.timeline')}
                    </h3>
                    <ol className="flex flex-col border-l-2 border-line pl-4">
                      {[...d.events]
                        .sort((a, b) => b.created_at.localeCompare(a.created_at))
                        .slice(0, 5)
                        .map((e) => (
                          <li key={e.id} className="flex items-baseline justify-between gap-3 py-1.5">
                            <span className="text-body text-ink">{t(`gate.timeline.${e.type}`)}</span>
                            <span className="shrink-0 text-body-sm text-muted tabular-nums">{formatClock(e.created_at)}</span>
                          </li>
                        ))}
                    </ol>
                  </section>
                ) : null}
              </>
            )}
          </DrawerBody>
          {v && active ? (
            <DrawerFooter>
              <Button
                variant="secondary"
                size="md"
                block
                loading={resend.isPending}
                icon={<Send size={20} strokeWidth={1.75} aria-hidden="true" />}
                onClick={() => resend.mutate()}
              >
                {t('gate.vehicle.resend')}
              </Button>
              {canChange ? (
                <Button
                  variant="secondary"
                  size="md"
                  block
                  icon={<ArrowLeftRight size={20} strokeWidth={1.75} aria-hidden="true" />}
                  onClick={() => setChangeOpen(true)}
                >
                  {t('gate.vehicle.changeSlot')}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="md"
                block
                icon={<LogOut size={20} strokeWidth={1.75} aria-hidden="true" />}
                onClick={() => setExitOpen(true)}
              >
                {t('gate.exit.markExit')}
              </Button>
              {canCancel ? (
                <Button
                  variant="danger-ghost"
                  size="md"
                  block
                  icon={<XCircle size={20} strokeWidth={1.75} aria-hidden="true" />}
                  onClick={() => setCancelOpen(true)}
                >
                  {t('gate.vehicle.cancel')}
                </Button>
              ) : null}
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={t('gate.exit.confirmTitle', { plate: plateText })}
        confirmLabel={t('gate.exit.markExit')}
        onConfirm={doExit}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('gate.vehicle.cancelTitle', { plate: plateText })}
        description={t('gate.vehicle.cancelBody')}
        confirmLabel={t('gate.vehicle.cancel')}
        cancelLabel={t('gate.vehicle.keep')}
        tone="danger"
        confirmDisabled={reason.trim().length < 3}
        onConfirm={doCancel}
      >
        <Field label={t('gate.vehicle.reason')} htmlFor="cancel-reason">
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={200} />
        </Field>
      </ConfirmDialog>

      {v && d ? (
        <ChangeSlotSheet
          open={changeOpen}
          onOpenChange={setChangeOpen}
          eventId={eventId}
          gateId={gateId ?? v.entry_gate_id ?? ''}
          visitId={v.id}
          vehicleType={v.vehicle_type}
          category={v.category}
          needsAccessible={v.needs_accessible}
          onChanged={refreshLists}
        />
      ) : null}
    </>
  )
}
