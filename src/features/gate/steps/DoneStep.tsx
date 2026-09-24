import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Check, CheckCheck, CircleX, LoaderCircle, MessageCircle, RotateCw } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { PlateChip } from '@/components/common/PlateChip'
import { VehiclePreview } from '@/components/common/VehiclePreview'
import { SlotLabel } from '@/components/common/SlotLabel'
import { DEMO_MODE } from '@/config/app'
import { useErrorText } from '@/hooks/useErrorText'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import { waErrorKey } from '@/lib/waErrors'
import type { EventMapData, WaStatus } from '@/types/domain'
import { getWaMessage, resendDriverLink } from '../api'
import { useCheckinStore } from '../store'
import { StepBody } from './StepBody'

const STATUS_ICON: Record<WaStatus, typeof Check> = {
  queued: LoaderCircle,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: CircleX,
}

/** Step 5: slot, WhatsApp status (live), QR fallback (docs/07 section 3.2). */
export function DoneStep({ eventMap }: { eventMap: EventMapData }) {
  const { t } = useTranslation('gate')
  const qc = useQueryClient()
  const errorText = useErrorText()
  const store = useCheckinStore()
  const result = store.result
  const slot = store.slot
  const messageId = result?.waMessageId ?? ''

  const message = useQuery({
    queryKey: queryKeys.waMessage(messageId),
    queryFn: () => getWaMessage(messageId),
    enabled: Boolean(messageId),
  })
  useRealtime(['whatsapp_messages'], () => {
    if (messageId) void qc.invalidateQueries({ queryKey: queryKeys.waMessage(messageId) })
  })

  const resend = useMutation({
    mutationFn: () => resendDriverLink(result?.visitId ?? ''),
    onSuccess: (res) => {
      if (res.message_id && result) store.patch({ result: { ...result, waMessageId: res.message_id, waStatus: res.status ?? 'queued' } })
      toast.success(t('gate.vehicle.linkSent'))
    },
    onError: (err) => toast.error(errorText(err)),
  })

  if (!result || !slot) return null
  const status: WaStatus = message.data?.status ?? result.waStatus
  const failed = status === 'failed'
  const Icon = STATUS_ICON[status]
  const zoneColor = eventMap.zones.features.find((z) => z.properties.code === slot.zoneCode)?.properties.color ?? null

  return (
    <StepBody
      actions={
        <Button size="lg" block onClick={() => store.reset()}>
          {t('gate.done.next')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <VehiclePreview
          vehicleType={store.details.vehicleType}
          color={store.details.color}
          make={store.details.make}
          plate={store.details.plateRaw}
        />
        <SlotLabel size="xl" label={slot.label} zoneColor={zoneColor} zoneName={slot.zoneName} />
        <PlateChip plate={store.details.plateRaw} size="md" className="self-start" />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <span className="text-body-sm font-semibold text-muted">{t('gate.done.whatsapp')}</span>
        <span
          aria-live="polite"
          className={cn(
            'ml-auto inline-flex items-center gap-2 text-body font-semibold',
            failed ? 'text-danger' : status === 'read' ? 'text-primary' : status === 'queued' ? 'text-muted' : 'text-success',
          )}
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" className={status === 'queued' ? 'animate-spin' : undefined} />
          {t(`common.enums.waStatus.${status}`)}
        </span>
      </div>

      {failed ? (
        <Alert
          tone="danger"
          title={t('gate.done.failedTitle')}
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={resend.isPending}
              icon={<RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => resend.mutate()}
            >
              {t('gate.done.resend')}
            </Button>
          }
        >
          {t(waErrorKey(message.data?.error_code ?? null))}
        </Alert>
      ) : null}

      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-md border border-line bg-surface p-2">
          <QRCodeSVG value={result.link} size={failed ? 240 : 160} marginSize={0} title={t('gate.done.qrTitle')} />
        </div>
        {failed ? null : <p className="text-body text-muted">{t('gate.done.scanQr')}</p>}
      </div>
      {failed ? <p className="text-body text-muted">{t('gate.done.scanQr')}</p> : null}

      {DEMO_MODE ? (
        <a
          href="/sim"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-md text-body-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
          {t('gate.done.simulator')}
        </a>
      ) : null}
    </StepBody>
  )
}
