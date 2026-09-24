import { call } from '@/lib/demo/client'
import * as rpc from '@/lib/demo/rpc'
import type { EventMapData, EventRow, SlotStatusRow } from '@/types/domain'

/** get_event_map. Use with staleTime Infinity; invalidate on the realtime 'map' table. */
export function fetchEventMap(eventId: string): Promise<EventMapData> {
  return call(() => rpc.getEventMap(eventId))
}

/** get_slot_statuses. Staff get every slot; drivers only their own. */
export function fetchSlotStatuses(eventId: string): Promise<SlotStatusRow[]> {
  return call(() => rpc.getSlotStatuses(eventId))
}

/** The event with status live, or null. */
export function fetchLiveEvent(): Promise<EventRow | null> {
  return call(() => rpc.getLiveEvent())
}

export function fetchEvent(id: string): Promise<EventRow> {
  return call(() => rpc.getEvent(id))
}
