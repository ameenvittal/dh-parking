import type { EventMapData, SlotStatus, VehicleType } from '@/types/domain'
import { localName } from '@/lib/format'
import type { CheckinSlot } from './store'

/** Slot label and zone for a slot id, from the event map. */
export function slotFromMap(eventMap: EventMapData, slotId: string, lang: string): CheckinSlot | null {
  const s = eventMap.slots.features.find((f) => f.id === slotId)
  if (!s) return null
  const z = eventMap.zones.features.find((f) => f.id === s.properties.zone_id)
  return {
    id: slotId,
    label: s.properties.label,
    zoneCode: z?.properties.code ?? '',
    zoneName: z ? localName(z.properties, lang) : '',
  }
}

/** Slot types a vehicle may use: `other` is routed like `car` unless a zone allows `other` (docs/03 section 2). */
export function slotTypesFor(type: VehicleType): VehicleType[] {
  return type === 'other' ? ['other', 'car'] : [type]
}

export function slotSelectable(
  eventMap: EventMapData,
  statuses: Map<string, SlotStatus> | undefined,
  slotId: string,
  type: VehicleType,
): boolean {
  const s = eventMap.slots.features.find((f) => f.id === slotId)
  if (!s || !slotTypesFor(type).includes(s.properties.vehicle_type)) return false
  return statuses?.get(slotId) === 'available'
}
