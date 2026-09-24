import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PlateChip } from '@/components/common/PlateChip'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { useErrorText } from '@/hooks/useErrorText'
import { errorCode } from '@/lib/errors'
import { normalizePlate } from '@/lib/plate'
import type { EventMapData, EventRow } from '@/types/domain'
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
        fee_amount: 0,
        payment_method: 'free',
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
    </StepBody>
  )
}
