import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Phone } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/ErrorState'
import { KeyValue } from '@/components/common/KeyValue'
import { PlateChip } from '@/components/common/PlateChip'
import { alertTypeMeta } from '@/components/common/statusMeta'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { BaseMap } from '@/features/map/BaseMap'
import { MapMarker } from '@/features/map/MapMarker'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { formatDateTime } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import type { AlertView } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { DetailPanel, PanelSection } from '../components/DetailPanel'
import { useAdminRefresh } from '../components/useAdminRefresh'
import { getAlert, getPhotoUrl, updateAlert } from './api'

type AlertDrawerProps = {
  alertId: string | null
  onOpenChange: (open: boolean) => void
  onOpenVehicle: (visitId: string) => void
}

/** Alert detail (docs/07 section 5.4): location map, details, photo, vehicle, acknowledge and resolve. */
export function AlertDrawer({ alertId, onOpenChange, onOpenVehicle }: AlertDrawerProps) {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const id = alertId ?? ''
  const query = useQuery({ queryKey: queryKeys.alert(id), queryFn: () => getAlert(id), enabled: Boolean(alertId) })
  const onChange = useCallback(() => {
    if (alertId) void qc.invalidateQueries({ queryKey: queryKeys.alert(alertId) })
  }, [qc, alertId])
  useRealtime(['alerts'], onChange)

  const a = query.data
  const meta = a ? alertTypeMeta[a.type] : null
  const Icon = meta?.icon

  return (
    <DetailPanel
      open={Boolean(alertId)}
      onOpenChange={onOpenChange}
      title={
        a && Icon && meta ? (
          <span className="inline-flex items-center gap-2">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" className={meta.text} />
            {t(`admin.alertType.${a.type}`)}
          </span>
        ) : (
          <Skeleton className="h-6 w-40" />
        )
      }
      headerExtra={a ? <Badge tone={a.status === 'open' ? 'warning' : a.status === 'resolved' ? 'success' : 'neutral'}>{t(`admin.alertStatus.${a.status}`)}</Badge> : null}
      footer={a ? <AlertActions alert={a} /> : undefined}
    >
      {query.isLoading ? (
        <Skeleton className="h-56 w-full rounded-lg" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : a ? (
        <AlertBody alert={a} onOpenVehicle={onOpenVehicle} />
      ) : null}
    </DetailPanel>
  )
}

function AlertBody({ alert: a, onOpenVehicle }: { alert: AlertView; onOpenVehicle: (visitId: string) => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const photo = useQuery({
    queryKey: queryKeys.photoUrl(a.photo_path ?? ''),
    queryFn: () => getPhotoUrl(a.photo_path ?? ''),
    enabled: Boolean(a.photo_path),
    staleTime: Infinity,
  })
  const dash = t('admin.shared.dash')
  return (
    <>
      <PanelSection title={t('admin.alerts.drawer.location')}>
        {a.location ? <AlertMap eventId={a.event_id} location={a.location} /> : <p className="text-body-sm text-muted">{t('admin.alerts.drawer.noLocation')}</p>}
      </PanelSection>

      <dl>
        {a.sos_reason ? <KeyValue label={t('admin.alerts.drawer.reason')} value={t(`admin.sosReason.${a.sos_reason}`)} /> : null}
        <KeyValue label={t('admin.alerts.drawer.message')} value={a.message ?? dash} />
        <KeyValue label={t('admin.alerts.drawer.raisedByLabel')} value={a.raised_by_label} />
        <KeyValue label={t('admin.alerts.drawer.raised')} value={formatDateTime(a.created_at)} />
        {a.zone_code ? <KeyValue label={t('admin.alerts.filterZone')} value={a.zone_code} /> : null}
        {a.acknowledged_at ? <KeyValue label={t('admin.alerts.drawer.acknowledgedAt')} value={formatDateTime(a.acknowledged_at)} /> : null}
        {a.resolved_at ? <KeyValue label={t('admin.alerts.drawer.resolvedAt')} value={formatDateTime(a.resolved_at)} /> : null}
        {a.resolution_note ? <KeyValue label={t('admin.alerts.drawer.note')} value={a.resolution_note} /> : null}
      </dl>

      {a.photo_path ? (
        <PanelSection title={t('admin.alerts.drawer.photo')}>
          {photo.data ? (
            <img src={photo.data} alt={t('admin.alerts.drawer.photo')} className="w-full rounded-lg border border-line object-cover" />
          ) : (
            <Skeleton className="aspect-4/3 w-full rounded-lg" />
          )}
        </PanelSection>
      ) : null}

      {a.plate ? (
        <PanelSection title={t('admin.alerts.drawer.vehicle')}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
            <span className="flex items-center gap-3">
              <PlateChip plate={a.plate} size="md" />
              {a.slot_label ? <span className="font-display text-h3 font-bold tabular-nums">{a.slot_label}</span> : null}
            </span>
            {a.visit_id ? (
              <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => a.visit_id && onOpenVehicle(a.visit_id)}>
                {t('admin.alerts.drawer.openVehicle')}
              </Button>
            ) : null}
          </div>
        </PanelSection>
      ) : null}
    </>
  )
}

function AlertMap({ eventId, location }: { eventId: string; location: [number, number] }) {
  const { eventMap, slotStatuses } = useMapData(eventId)
  if (!eventMap) return <Skeleton className="h-56 w-full rounded-lg" />
  const d = 0.0008
  return (
    <div className="h-56 overflow-hidden rounded-lg border border-line">
      <BaseMap
        eventMap={eventMap}
        baseLayer={eventMap.event.base_map}
        fitTo={{ bbox: [location[0] - d, location[1] - d, location[0] + d, location[1] + d] }}
        slotStatuses={slotStatuses}
        showZoneLabels={false}
      >
        <MapMarker lngLat={location} anchor="bottom">
          <MapPin size={32} strokeWidth={2} aria-hidden="true" className="fill-danger text-surface" />
        </MapMarker>
      </BaseMap>
    </div>
  )
}

function AlertActions({ alert: a }: { alert: AlertView }) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const refresh = useAdminRefresh()
  const [note, setNote] = useState('')
  const [resolving, setResolving] = useState(false)

  const mutation = useMutation({
    mutationFn: (status: 'acknowledged' | 'resolved') => updateAlert(a.id, status, status === 'resolved' ? note.trim() || null : null),
    onSuccess: (_r, status) => {
      toast.success(t(status === 'resolved' ? 'admin.alerts.drawer.resolvedToast' : 'admin.alerts.drawer.acknowledgedToast'))
      setResolving(false)
      setNote('')
      refresh()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  if (a.status === 'resolved') return null
  return (
    <div className="flex w-full flex-col gap-3">
      {resolving ? (
        <Field label={t('admin.alerts.drawer.note')} htmlFor="resolve-note">
          <Textarea
            id="resolve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('admin.alerts.drawer.notePlaceholder')}
            rows={2}
          />
        </Field>
      ) : null}
      <div className={cn('flex flex-wrap gap-2')}>
        {a.type === 'sos' && a.driver_phone ? (
          <Button asChild variant="secondary" size="md" className={ADMIN_BTN}>
            <a href={`tel:${a.driver_phone}`} aria-label={`${t('admin.alerts.drawer.callDriver')} ${formatPhone(a.driver_phone)}`}>
              <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('admin.alerts.drawer.callDriver')}
            </a>
          </Button>
        ) : null}
        {a.status === 'open' && !resolving ? (
          <Button variant="secondary" size="md" className={ADMIN_BTN} loading={mutation.isPending && mutation.variables === 'acknowledged'} onClick={() => mutation.mutate('acknowledged')}>
            {t('admin.alerts.drawer.acknowledge')}
          </Button>
        ) : null}
        {resolving ? (
          <>
            <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => setResolving(false)}>
              {t('admin.shared.cancel')}
            </Button>
            <Button size="md" className={ADMIN_BTN} loading={mutation.isPending} onClick={() => mutation.mutate('resolved')}>
              {t('admin.alerts.drawer.resolve')}
            </Button>
          </>
        ) : (
          <Button size="md" className={ADMIN_BTN} onClick={() => setResolving(true)}>
            {t('admin.alerts.drawer.resolve')}
          </Button>
        )}
      </div>
    </div>
  )
}
