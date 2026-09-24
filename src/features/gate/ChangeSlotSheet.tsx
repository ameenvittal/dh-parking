import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { errorCode } from '@/lib/errors'
import type { VehicleType, VisitorCategory } from '@/types/domain'
import { reassignVisit } from './api'
import { SlotChooser } from './SlotChooser'
import type { CheckinSlot } from './store'

type ChangeSlotSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  gateId: string
  visitId: string
  vehicleType: VehicleType
  category: VisitorCategory
  needsAccessible: boolean
  onChanged: () => void
}

/** Step-4-like slot picker, then visit-reassign with a new WhatsApp message (docs/07 section 3.5). */
export function ChangeSlotSheet(props: ChangeSlotSheetProps) {
  const { open, onOpenChange, eventId, gateId, visitId, vehicleType, category, needsAccessible, onChanged } = props
  const { t } = useTranslation('gate')
  const errorText = useErrorText()
  const { eventMap } = useMapData(open ? eventId : null, { withStatuses: false })
  const [slot, setSlot] = useState<CheckinSlot | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const change = useMutation({
    mutationFn: () => reassignVisit({ visitId, newSlotId: slot?.id ?? '', notify: true }),
    onSuccess: (res) => {
      toast.success(t('gate.vehicle.slotChanged', { slot: res.slot.label }))
      onChanged()
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(errorText(err))
      if (errorCode(err) === 'SLOT_TAKEN') {
        setSlot(null)
        setRefreshKey((k) => k + 1)
      }
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-11/12 flex-col p-0">
        <div className="border-b border-line px-4 py-3 pr-14">
          <SheetTitle className="text-h3 text-ink">{t('gate.vehicle.changeSlot')}</SheetTitle>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {eventMap ? (
            <SlotChooser
              eventId={eventId}
              eventMap={eventMap}
              gateId={gateId}
              vehicleType={vehicleType}
              category={category}
              needsAccessible={needsAccessible}
              selected={slot}
              onSelect={setSlot}
              refreshKey={refreshKey}
            />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </div>
        <div className="border-t border-line px-4 py-3 pb-safe">
          <Button size="lg" block disabled={!slot} loading={change.isPending} onClick={() => change.mutate()}>
            {slot ? t('gate.vehicle.moveTo', { slot: slot.label }) : t('gate.vehicle.changeSlot')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
