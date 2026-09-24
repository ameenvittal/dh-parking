import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/Sheet'
import { SlotLabel } from '@/components/common/SlotLabel'
import { BaseMap } from '@/features/map/BaseMap'
import { MapControls } from '@/features/map/MapControls'
import { useMapData } from '@/features/map/useMapData'
import type { BaseMapKind, VehicleType } from '@/types/domain'
import type { CheckinSlot } from './store'
import { slotFromMap, slotSelectable, slotTypesFor } from './slotInfo'

type SlotPickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  vehicleType: VehicleType
  onPick: (slot: CheckinSlot) => void
}

/** Full-screen map picker (docs/07 section 3.2, step 4): only free slots of the matching type can be picked. */
export function SlotPickerSheet({ open, onOpenChange, eventId, vehicleType, onPick }: SlotPickerSheetProps) {
  const { t, i18n } = useTranslation('gate')
  const { eventMap, slotStatuses } = useMapData(open ? eventId : null)
  const [picked, setPicked] = useState<CheckinSlot | null>(null)
  const [notFree, setNotFree] = useState(false)
  const [base, setBase] = useState<BaseMapKind | null>(null)

  const zoneColor = picked && eventMap ? eventMap.zones.features.find((z) => z.properties.code === picked.zoneCode)?.properties.color : null

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPicked(null)
          setNotFree(false)
        }
        onOpenChange(o)
      }}
    >
      <SheetContent side="bottom" className="flex h-11/12 flex-col overflow-hidden p-0">
        <div className="flex flex-col gap-0.5 border-b border-line px-4 py-3 pr-14">
          <SheetTitle className="text-h3 text-ink">{t('gate.slot.pickTitle')}</SheetTitle>
          <SheetDescription className="text-body-sm text-muted">{t('gate.slot.pickHelp')}</SheetDescription>
        </div>
        <div className="relative min-h-0 flex-1">
          {eventMap ? (
            <BaseMap
              eventMap={eventMap}
              baseLayer={base ?? eventMap.event.base_map}
              slotStatuses={slotStatuses}
              activeVehicleTypes={slotTypesFor(vehicleType)}
              highlightSlotId={picked?.id}
              ariaLabel={t('gate.slot.pickTitle')}
              onSlotClick={(id) => {
                if (!slotSelectable(eventMap, slotStatuses, id, vehicleType)) {
                  setNotFree(true)
                  return
                }
                setNotFree(false)
                setPicked(slotFromMap(eventMap, id, i18n.language))
              }}
            >
              <MapControls baseLayer={base ?? eventMap.event.base_map} onBaseLayerChange={setBase} />
            </BaseMap>
          ) : (
            <div className="size-full bg-surface-2" />
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line bg-surface px-4 py-3 pb-safe">
          <div aria-live="polite" className="min-w-0 flex-1">
            {picked ? (
              <SlotLabel size="sm" label={picked.label} zoneColor={zoneColor} />
            ) : (
              <p className="text-body-sm text-muted">{notFree ? t('gate.slot.notFree') : t('gate.slot.tapSlot')}</p>
            )}
          </div>
          <Button
            size="lg"
            disabled={!picked}
            onClick={() => {
              if (!picked) return
              onPick(picked)
              setPicked(null)
              onOpenChange(false)
            }}
          >
            {t('gate.slot.useSlot')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
