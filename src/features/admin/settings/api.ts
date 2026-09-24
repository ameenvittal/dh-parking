import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import * as rpc from '@/lib/demo/rpc'
import type { EventInput, TestMessageInput, TestMessageResult } from '@/lib/demo/types'
import type { EventRow } from '@/types/domain'

export type { EventInput, TestMessageInput, TestMessageResult }

export function getEventSettings(eventId: string): Promise<EventRow> {
  return call(() => rpc.getEvent(eventId))
}

/** Saves one settings section. Uses admin_upsert_event with only the changed fields. */
export function updateEventSettings(eventId: string, patch: Omit<EventInput, 'id'>): Promise<EventRow> {
  return call(() => rpc.upsertEvent({ ...patch, id: eventId }))
}

/** WhatsApp test from Settings. Status then moves live through the 'whatsapp_messages' table. */
export function sendTestMessage(input: TestMessageInput): Promise<TestMessageResult> {
  return call(() => fn.sendTestMessage(input))
}
