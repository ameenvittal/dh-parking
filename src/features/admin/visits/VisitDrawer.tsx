import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, CircleCheck, CircleX, Copy, ImageOff, LogOut, MessageCircle } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { KeyValue } from '@/components/common/KeyValue'
import { PlateChip } from '@/components/common/PlateChip'
import { VehiclePreview } from '@/components/common/VehiclePreview'
import { StatusBadge } from '@/components/common/StatusBadge'
import { alertTypeMeta } from '@/components/common/statusMeta'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { Tooltip } from '@/components/ui/Tooltip'
import { BaseMap } from '@/features/map/BaseMap'
import { useMapData } from '@/features/map/useMapData'
import { VisitTimeline } from '@/features/zone/VisitTimeline'
import { useErrorText } from '@/hooks/useErrorText'
import { formatClock, formatDateTime, formatInr, formatPlate, localName } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import type { VisitDetail, VisitEventRow } from '@/types/domain'
import { listStaff } from '../staff/api'
import { ADMIN_BTN } from '../components/buttonSizes'
import { DetailPanel, PanelSection } from '../components/DetailPanel'
import { TrailLayer } from '../components/TrailLayer'
import { useAdminRefresh } from '../components/useAdminRefresh'
import { cancelVisit, confirmParked, getPhotoUrl, getVisitDetail, markExit, resendDriverLink } from './api'
import { ChangeSlotDialog } from './ChangeSlotDialog'

type VisitDrawerProps = {
  visitId: string | null
  onOpenChange: (open: boolean) => void
}

const ACTIVE = new Set(['assigned', 'en_route', 'driver_parked', 'confirmed'])

/** Vehicle detail drawer (docs/07 section 5.3). Used by Vehicles, Dashboard, Alerts and the live map. */
export function VisitDrawer({ visitId, onOpenChange }: VisitDrawerProps) {
  const qc = useQueryClient()
  const id = visitId ?? ''
  const detail = useQuery({ queryKey: queryKeys.visitDetail(id), queryFn: () => getVisitDetail(id), enabled: Boolean(visitId) })
  const onChange = useCallback(() => {
    if (visitId) void qc.invalidateQueries({ queryKey: queryKeys.visitDetail(visitId) })
  }, [qc, visitId])
  useRealtime(['visits', 'alerts', 'whatsapp_messages'], onChange)

  const d = detail.data
  return (
    <DetailPanel
      open={Boolean(visitId)}
      onOpenChange={onOpenChange}
      title={
        d ? (
          <div className="flex flex-col gap-3 w-full">
            <VehiclePreview
              vehicleType={d.visit.vehicle_type}
              color={d.visit.vehicle_color}
              make={d.visit.vehicle_make}
              plate={d.visit.plate}
            />
            <PlateChip plate={d.visit.plate} size="lg" />
          </div>
        ) : (
          <Skeleton className="h-13 w-48" />
        )
      }
      headerExtra={d ? <StatusBadge status={d.visit.status} vehicleType={d.visit.vehicle_type} /> : null}
      footer={d ? <VisitActions detail={d} /> : undefined}
    >
      {detail.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-4/3 w-full rounded-lg" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : d ? (
        <VisitBody detail={d} />
      ) : null}
    </DetailPanel>
  )
}

function VisitBody({ detail: d }: { detail: VisitDetail }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const v = d.visit
  const [photoOpen, setPhotoOpen] = useState(false)
  const photo = useQuery({
    queryKey: queryKeys.photoUrl(v.photo_path ?? ''),
    queryFn: () => getPhotoUrl(v.photo_path ?? ''),
    enabled: Boolean(v.photo_path),
    staleTime: Infinity,
  })
  const staff = useQuery({ queryKey: queryKeys.staff(), queryFn: listStaff, staleTime: 60_000 })
  const staffName = useMemo(() => new Map((staff.data ?? []).map((s) => [s.id, s.full_name])), [staff.data])
  const actorName = (e: VisitEventRow): string | null => {
    if (e.actor_role === 'driver') return t('admin.shared.driver')
    if (!e.actor_id) return e.actor_role ? null : t('admin.shared.system')
    return staffName.get(e.actor_id) ?? null
  }
  const yesNo = (b: boolean) => (b ? t('admin.shared.yes') : t('admin.shared.no'))
  const dash = t('admin.shared.dash')

  return (
    <>
      <PanelSection title={t('admin.vehicles.drawer.photo')}>
        {v.photo_path ? (
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            aria-label={t('admin.vehicles.drawer.enlarge')}
            className="block overflow-hidden rounded-lg bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {photo.data ? (
              <img src={photo.data} alt={t('admin.vehicles.drawer.photo')} className="aspect-4/3 w-full object-cover" />
            ) : (
              <Skeleton className="aspect-4/3 w-full" />
            )}
          </button>
        ) : (
          <div className="flex h-24 items-center justify-center gap-2 rounded-lg bg-surface-2 text-body-sm text-muted">
            <ImageOff size={20} strokeWidth={1.75} aria-hidden="true" />
            {t('admin.vehicles.drawer.noPhoto')}
          </div>
        )}
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.details')}>
        <dl>
          <KeyValue label={t('admin.vehicles.drawer.type')} value={t(`common.enums.vehicleType.${v.vehicle_type}`)} />
          <KeyValue label={t('admin.vehicles.drawer.colour')} value={<span className="capitalize">{v.vehicle_color ?? dash}</span>} />
          <KeyValue label={t('admin.vehicles.drawer.make')} value={v.vehicle_make ?? dash} />
          <KeyValue label={t('admin.vehicles.drawer.category')} value={t(`common.enums.category.${v.category}`)} />
          <KeyValue label={t('admin.vehicles.drawer.passNumber')} value={v.pass_number ?? dash} />
          <KeyValue label={t('admin.vehicles.drawer.holder')} value={v.pass_holder_name ?? dash} />
          <KeyValue label={t('admin.vehicles.drawer.accessible')} value={yesNo(v.needs_accessible)} />
        </dl>
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.driver')}>
        <dl>
          <KeyValue
            label={t('admin.vehicles.drawer.phone')}
            value={
              d.driver ? (
                <span className="inline-flex items-center gap-1">
                  <a href={`tel:${d.driver.phone}`} className="text-primary tabular-nums underline-offset-4 hover:underline">
                    {formatPhone(d.driver.phone)}
                  </a>
                  <button
                    type="button"
                    aria-label={t('admin.vehicles.drawer.copyPhone')}
                    title={t('admin.vehicles.drawer.copyPhone')}
                    onClick={() => {
                      void navigator.clipboard?.writeText(d.driver?.phone ?? '').then(() => toast.success(t('admin.shared.copied')))
                    }}
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </span>
              ) : (
                dash
              )
            }
          />
          <KeyValue label={t('admin.vehicles.drawer.name')} value={d.driver?.name ?? dash} />
          <KeyValue
            label={t('admin.vehicles.drawer.language')}
            value={d.driver ? t(`common.languages.${d.driver.preferred_language}`) : dash}
          />
        </dl>
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.parking')}>
        <dl>
          <KeyValue label={t('admin.vehicles.drawer.slot')} value={<span className="font-display font-bold">{d.slot?.label ?? dash}</span>} />
          <KeyValue label={t('admin.vehicles.drawer.zone')} value={d.zone ? `${d.zone.code} ${localName(d.zone, i18n.language)}` : dash} />
          <KeyValue label={t('admin.vehicles.drawer.gate')} value={d.entry_gate?.name ?? dash} />
          {d.exit_gate ? <KeyValue label={t('admin.vehicles.drawer.exitGate')} value={d.exit_gate.name} /> : null}
          <KeyValue
            label={t('admin.vehicles.drawer.fee')}
            value={`${formatInr(v.fee_amount)}  ${t(`admin.paymentMethod.${v.payment_method}`)}`}
          />
        </dl>
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.timeline')}>
        <VisitTimeline events={d.events} actorName={actorName} />
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.messages')}>
        {d.messages.length === 0 ? (
          <p className="text-body-sm text-muted">{t('admin.vehicles.drawer.noMessages')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {d.messages.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-sm text-ink">{t(`admin.waTemplate.${m.template}`)}</span>
                  {m.error_title ? <span className="text-caption text-danger">{m.error_title}</span> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={m.status === 'failed' ? 'danger' : m.status === 'read' || m.status === 'delivered' ? 'success' : 'neutral'}>
                    {t(`admin.waStatus.${m.status}`)}
                  </Badge>
                  <span className="text-caption text-muted tabular-nums">{formatClock(m.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.alerts')}>
        {d.alerts.length === 0 ? (
          <p className="text-body-sm text-muted">{t('admin.vehicles.drawer.noAlerts')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.alerts.map((a) => {
              const meta = alertTypeMeta[a.type]
              const Icon = meta.icon
              return (
                <li key={a.id} className="flex items-start gap-3 rounded-md border border-line px-3 py-2.5">
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={`mt-0.5 shrink-0 ${meta.text}`} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-sm text-ink">{t(`admin.alertType.${a.type}`)}</span>
                    {a.message ? <span className="text-caption text-muted">{a.message}</span> : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={a.status === 'open' ? 'warning' : 'neutral'}>{t(`admin.alertStatus.${a.status}`)}</Badge>
                    <span className="text-caption text-muted">{formatDateTime(a.created_at)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </PanelSection>

      <PanelSection title={t('admin.vehicles.drawer.trail')}>
        {d.trail.length >= 2 ? <TrailMap eventId={v.event_id} trail={d.trail} slotId={v.slot_id} /> : (
          <p className="text-body-sm text-muted">{t('admin.vehicles.drawer.noTrail')}</p>
        )}
      </PanelSection>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-3xl p-2 lg:p-2">
          <DialogTitle className="sr-only">{formatPlate(v.plate)}</DialogTitle>
          {photo.data ? <img src={photo.data} alt={t('admin.vehicles.drawer.photo')} className="w-full rounded-md" /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function TrailMap({ eventId, trail, slotId }: { eventId: string; trail: VisitDetail['trail']; slotId: string | null }) {
  const { eventMap, slotStatuses } = useMapData(eventId)
  if (!eventMap) return <Skeleton className="h-56 w-full rounded-lg" />
  const lngs = trail.map((p) => p[0])
  const lats = trail.map((p) => p[1])
  const bbox: [number, number, number, number] = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
  return (
    <div className="h-56 overflow-hidden rounded-lg border border-line">
      <BaseMap
        eventMap={eventMap}
        baseLayer={eventMap.event.base_map}
        fitTo={{ bbox }}
        slotStatuses={slotStatuses}
        highlightSlotId={slotId ?? undefined}
        showRoads
        showZoneLabels={false}
      >
        <TrailLayer trail={trail} />
      </BaseMap>
    </div>
  )
}

/** Footer actions with the backend state rules; disabled ones explain why in a tooltip. */
function VisitActions({ detail: d }: { detail: VisitDetail }) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const refresh = useAdminRefresh()
  const v = d.visit
  const active = ACTIVE.has(v.status)
  const beforeParked = v.status === 'assigned' || v.status === 'en_route'
  const [slotOpen, setSlotOpen] = useState(false)
  const [exitOpen, setExitOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')

  const resend = useMutation({
    mutationFn: () => resendDriverLink(v.id),
    onSuccess: () => {
      toast.success(t('admin.vehicles.resendDone'))
      refresh()
    },
    onError: (err) => toast.error(errorText(err)),
  })
  const confirm = useMutation({
    mutationFn: () => confirmParked(v.id),
    onSuccess: () => {
      toast.success(t('admin.vehicles.confirmDone'))
      refresh()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const notActive = t('admin.vehicles.actions.notActive')
  const action = (label: string, reasonText: string | null, node: (disabled: boolean) => ReactNode) => (
    <Tooltip key={label} content={reasonText}>
      <span className="inline-flex">{node(Boolean(reasonText))}</span>
    </Tooltip>
  )

  return (
    <>
      <div className="flex w-full flex-wrap gap-2">
        {action(
          'confirm',
          v.status === 'confirmed' ? t('admin.vehicles.actions.alreadyConfirmed') : active ? null : notActive,
          (dis) => (
            <Button
              variant="primary"
              size="md"
              className={ADMIN_BTN}
              disabled={dis}
              loading={confirm.isPending}
              icon={<CircleCheck size={16} strokeWidth={2.25} />}
              onClick={() => confirm.mutate()}
            >
              {t('admin.vehicles.actions.confirmParked')}
            </Button>
          ),
        )}
        {action('slot', active ? null : notActive, (dis) => (
          <Button
            variant="secondary"
            size="md"
            className={cn(ADMIN_BTN, 'hover:border-primary hover:text-primary hover:bg-primary-soft/60')}
            disabled={dis}
            icon={<ArrowRightLeft size={16} strokeWidth={2} />}
            onClick={() => setSlotOpen(true)}
          >
            {t('admin.vehicles.actions.changeSlot')}
          </Button>
        ))}
        {action('resend', !active ? notActive : !d.driver ? t('admin.vehicles.actions.noPhone') : null, (dis) => (
          <Button
            variant="secondary"
            size="md"
            className={cn(ADMIN_BTN, 'hover:border-primary hover:text-primary hover:bg-primary-soft/60')}
            disabled={dis}
            loading={resend.isPending}
            icon={<MessageCircle size={16} strokeWidth={2} />}
            onClick={() => resend.mutate()}
          >
            {t('admin.vehicles.actions.resendLink')}
          </Button>
        ))}
        {action('exit', active ? null : notActive, (dis) => (
          <Button
            variant="secondary"
            size="md"
            className={cn(ADMIN_BTN, 'hover:border-line-strong hover:bg-surface-2')}
            disabled={dis}
            icon={<LogOut size={16} strokeWidth={2} />}
            onClick={() => setExitOpen(true)}
          >
            {t('admin.vehicles.actions.markExit')}
          </Button>
        ))}
        {action('cancel', beforeParked ? null : t('admin.vehicles.actions.cancelOnlyBeforeParked'), (dis) => (
          <Button
            variant="danger-soft"
            size="md"
            className={ADMIN_BTN}
            disabled={dis}
            icon={<CircleX size={16} strokeWidth={2} />}
            onClick={() => setCancelOpen(true)}
          >
            {t('admin.vehicles.actions.cancel')}
          </Button>
        ))}
      </div>

      <ChangeSlotDialog open={slotOpen} onOpenChange={setSlotOpen} eventId={v.event_id} visit={v} />
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title={t('admin.vehicles.exitDialog.title', { plate: formatPlate(v.plate) })}
        confirmLabel={t('admin.vehicles.exitDialog.submit')}
        onConfirm={async () => {
          try {
            await markExit(v.id)
            toast.success(t('admin.vehicles.exitDialog.done'))
            refresh()
          } catch (err) {
            toast.error(errorText(err))
            throw err
          }
        }}
      />
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o)
          if (!o) setReason('')
        }}
        tone="danger"
        title={t('admin.vehicles.cancelDialog.title', { plate: formatPlate(v.plate) })}
        description={t('admin.vehicles.cancelDialog.body')}
        confirmLabel={t('admin.vehicles.cancelDialog.submit')}
        cancelLabel={t('admin.vehicles.cancelDialog.keep')}
        confirmDisabled={reason.trim().length === 0}
        onConfirm={async () => {
          try {
            await cancelVisit(v.id, reason.trim())
            toast.success(t('admin.vehicles.cancelDialog.done'))
            refresh()
          } catch (err) {
            toast.error(errorText(err))
            throw err
          }
        }}
      >
        <Field label={t('admin.vehicles.cancelDialog.reason')} htmlFor="cancel-reason">
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </Field>
      </ConfirmDialog>
    </>
  )
}
