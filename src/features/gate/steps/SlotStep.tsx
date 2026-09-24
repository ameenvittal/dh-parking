import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PlateChip } from '@/components/common/PlateChip'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { useErrorText } from '@/hooks/useErrorText'
import { errorCode } from '@/lib/errors'
import { normalizePlate } from '@/lib/plate'
import type { EventMapData, EventRow, PaymentMethod } from '@/types/domain'
import { gateCheckin } from '../api'
import { SlotChooser } from '../SlotChooser'
import { useCheckinStore } from '../store'
import { StepBody } from './StepBody'

type SlotStepProps = { event: EventRow; eventMap: EventMapData; gateId: string }

/** Step 4: suggestions, zone chips, map picker, fee row, "Assign and send" (docs/07 section 3.2). */
export function SlotStep({ event, eventMap, gateId }: SlotStepProps) {
  const { t } = useTranslation('gate')
  const qc = useQueryClient()
  const errorText = useErrorText()
  const store = useCheckinStore()
  const d = store.details
  const [refreshKey, setRefreshKey] = useState(0)
  const TypeIcon = vehicleTypeIcon[d.vehicleType]

  // Fee: prefilled from the event's rule, forced free for exempt categories.
  const exempt = event.fee_exempt_categories.includes(d.category)
  const rule = event.fee_rules[d.vehicleType] ?? 0
  useEffect(() => {
    if (!event.paid_parking) {
      store.patch({ fee: { amount: 0, method: 'free' } })
      return
    }
    store.patch({ fee: exempt || rule === 0 ? { amount: 0, method: 'free' } : { amount: rule, method: 'cash' } })
    // recompute when the vehicle or category changes
  }, [event.paid_parking, exempt, rule]) // eslint-disable-line react-hooks/exhaustive-deps

  const assign = useMutation({
    mutationFn: () => {
      const s = useCheckinStore.getState()
      const ai = s.ai
      const plate = normalizePlate(s.details.plateRaw)
      return gateCheckin({
        event_id: event.id,
        gate_id: gateId,
        slot_id: s.slot?.id ?? '',
        phone: s.phone.number,
        driver_name: s.phone.name || null,
        language: s.phone.language,
        plate_raw: s.details.plateRaw,
        vehicle_type: s.details.vehicleType,
        vehicle_color: s.details.color || null,
        vehicle_make: s.details.make || null,
        category: s.details.category,
        pass_number: s.details.passNumber || null,
        pass_holder_name: s.details.passHolderName || null,
        needs_accessible: s.details.needsAccessible,
        photo_path: s.photoPaths[0] ?? null,
        ai_result: ai,
        ai_plate_confidence: ai?.plate_confidence ?? null,
        ai_edited: ai ? plate !== normalizePlate(ai.plate ?? '') || s.details.vehicleType !== ai.vehicle_type : false,
        fee_amount: s.fee.method === 'free' ? 0 : s.fee.amount,
        payment_method: s.fee.method,
        allow_duplicate: s.allowDuplicate,
        checkin_duration_ms: s.startedAt ? Date.now() - s.startedAt : null,
      })
    },
    onSuccess: (res) => {
      store.patch({
        slot: { id: res.slot.id, label: res.slot.label, zoneCode: res.slot.zone_code, zoneName: res.slot.zone_name },
        result: { visitId: res.visit_id, link: res.link, waMessageId: res.whatsapp.message_id, waStatus: res.whatsapp.status },
      })
      store.setStep('done')
      void qc.invalidateQueries({ queryKey: ['gateOverview'] })
    },
    onError: (err) => {
      toast.error(errorText(err))
      const code = errorCode(err)
      if (code === 'SLOT_TAKEN' || code === 'SLOT_BLOCKED' || code === 'SLOT_TYPE_MISMATCH') {
        store.patch({ slot: null })
        setRefreshKey((k) => k + 1)
      } else if (code === 'PLATE_ACTIVE') {
        store.setStep('details')
      } else if (code === 'INVALID_PHONE') {
        store.setStep('phone')
      }
    },
  })

  const fee = store.fee
  const setFee = (p: Partial<{ amount: number; method: PaymentMethod }>) => store.patch({ fee: { ...fee, ...p } })

  return (
    <StepBody
      actions={
        <Button
          size="lg"
          block
          disabled={!store.slot}
          loading={assign.isPending}
          icon={<Send size={20} strokeWidth={1.75} aria-hidden="true" />}
          onClick={() => assign.mutate()}
        >
          {t('gate.slot.assignSend')}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <PlateChip plate={d.plateRaw} size="sm" />
        <span className="inline-flex items-center gap-1.5 text-body-sm text-ink">
          <TypeIcon size={16} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
          {t(`common.enums.vehicleType.${d.vehicleType}`)}
        </span>
        <span className="text-body-sm text-muted">{t(`common.enums.category.${d.category}`)}</span>
      </div>

      <SlotChooser
        eventId={event.id}
        eventMap={eventMap}
        gateId={gateId}
        vehicleType={d.vehicleType}
        category={d.category}
        needsAccessible={d.needsAccessible}
        selected={store.slot}
        onSelect={(slot) => store.patch({ slot })}
        refreshKey={refreshKey}
      />

      {event.paid_parking ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          <Label>{t('gate.fee.title')}</Label>
          <Field
            label={t('gate.fee.amount')}
            htmlFor="fee-amount"
            helper={exempt ? t('gate.fee.freeFor', { category: t(`common.enums.category.${d.category}`) }) : undefined}
          >
            <Input
              id="fee-amount"
              inputMode="numeric"
              disabled={exempt || fee.method === 'free'}
              value={fee.method === 'free' ? '0' : String(fee.amount)}
              onChange={(e) => setFee({ amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </Field>
          <SegmentedControl<PaymentMethod>
            ariaLabel={t('gate.fee.method')}
            value={fee.method}
            onChange={(method) => setFee({ method, amount: method === 'free' ? 0 : fee.amount || rule })}
            options={(['cash', 'upi', 'free'] as const).map((m) => ({
              value: m,
              label: t(`common.enums.paymentMethod.${m}`),
              disabled: exempt && m !== 'free',
            }))}
          />
        </div>
      ) : null}
    </StepBody>
  )
}
