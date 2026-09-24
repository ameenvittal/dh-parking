import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { StatusBadge } from '@/components/common/StatusBadge'
import { VehicleCard } from '@/components/common/VehicleCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { BaseMap } from '@/features/map/BaseMap'
import { MapControls } from '@/features/map/MapControls'
import { MapMarker } from '@/features/map/MapMarker'
import type { BaseMapKind, EventMapData, SlotStatus, ZoneVisit } from '@/types/domain'

type ZoneMapViewProps = {
  eventMap: EventMapData | null
  slotStatuses: Map<string, SlotStatus> | undefined
  zoneIds: string[]
  visits: ZoneVisit[]
}

/** F-ZONE-02: zone map with slot colours and en-route vehicles at their last position. */
export function ZoneMapView({ eventMap, slotStatuses, zoneIds, visits }: ZoneMapViewProps) {
  const { t } = useTranslation(['zone', 'common'])
  const navigate = useNavigate()
  const [slotId, setSlotId] = useState<string | null>(null)
  const [base, setBase] = useState<BaseMapKind | null>(null)

  if (!eventMap) return <Skeleton className="h-112 w-full rounded-lg" />

  const moving = visits.filter((v) => (v.status === 'en_route' || v.status === 'assigned') && v.last_position)
  const slot = slotId ? eventMap.slots.features.find((f) => String(f.id) === slotId) : null
  const visitInSlot = slotId ? visits.find((v) => v.slot_id === slotId && v.status !== 'exited') : null
  const slotStatus = slotId ? slotStatuses?.get(slotId) : undefined

  return (
    <div className="-mx-4 h-112 overflow-hidden border-y border-line sm:mx-0 sm:rounded-lg sm:border">
      <BaseMap
        eventMap={eventMap}
        baseLayer={base ?? eventMap.event.base_map}
        fitTo="zone"
        visibleZoneIds={zoneIds}
        slotStatuses={slotStatuses}
        highlightSlotId={slotId ?? undefined}
        onSlotClick={setSlotId}
        ariaLabel={t('zone.view.map')}
      >
        <MapControls baseLayer={base ?? eventMap.event.base_map} onBaseLayerChange={setBase} />
        {moving.map((v) => (
          <MapMarker key={v.id} lngLat={v.last_position ?? [0, 0]}>
            <span
              aria-hidden="true"
              className="block size-3.5 rounded-full border-2 border-surface bg-status-enroute shadow-raised"
            />
          </MapMarker>
        ))}
      </BaseMap>

      <Drawer open={Boolean(slotId)} onOpenChange={(o) => !o && setSlotId(null)}>
        <DrawerContent>
          <DrawerHeader className="flex-row items-center justify-between">
            <DrawerTitle>{slot ? t('zone.zoneMap.slotStatus', { slot: slot.properties.label }) : ''}</DrawerTitle>
            {slotStatus ? <StatusBadge status={slotStatus} vehicleType={slot?.properties.vehicle_type} /> : null}
          </DrawerHeader>
          <DrawerBody>
            {visitInSlot ? (
              <VehicleCard
                plate={visitInSlot.plate}
                status={visitInSlot.status}
                vehicleType={visitInSlot.vehicle_type}
                color={visitInSlot.vehicle_color}
                make={visitInSlot.vehicle_make}
                category={visitInSlot.category}
                slotLabel={visitInSlot.slot_label}
              />
            ) : (
              <p className="py-4 text-body text-muted">{t('zone.zoneMap.slotSheetEmpty')}</p>
            )}
          </DrawerBody>
          {visitInSlot ? (
            <DrawerFooter>
              <Button size="lg" block onClick={() => void navigate(`/zone/visit/${visitInSlot.id}`)}>
                {t('zone.zoneMap.openVehicle')}
              </Button>
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
