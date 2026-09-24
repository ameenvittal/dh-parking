import { call } from '@/lib/demo/client'
import * as rpc from '@/lib/demo/rpc'
import type { EventInput, EventListItem } from '@/lib/demo/types'
import type { EventRow, EventStatus } from '@/types/domain'

export type { EventInput, EventListItem }

export function listEvents(): Promise<EventListItem[]> {
  return call(() => rpc.listEvents())
}

/** admin_upsert_event. New events start as draft. Throws BAD_REQUEST when ends_at is not after starts_at. */
export function upsertEvent(input: EventInput): Promise<EventRow> {
  return call(() => rpc.upsertEvent(input))
}

/** admin_set_event_status. Throws INVALID_STATE (detail: the other live event's name). */
export function setEventStatus(eventId: string, status: EventStatus): Promise<EventRow> {
  return call(() => rpc.setEventStatus(eventId, status))
}

export function setEventLive(eventId: string): Promise<EventRow> {
  return setEventStatus(eventId, 'live')
}

export function closeEvent(eventId: string): Promise<EventRow> {
  return setEventStatus(eventId, 'closed')
}
