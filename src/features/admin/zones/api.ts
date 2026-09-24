import { call } from '@/lib/demo/client'
import * as editor from '@/lib/demo/editor'
import * as rpc from '@/lib/demo/rpc'
import type { SetSlotsStatusResult, SlotPropsPatch, ZonesSlotsData } from '@/lib/demo/types'

export type { SetSlotsStatusResult, SlotPropsPatch, ZonesSlotsData }

/** Zones with counts and every slot with its current plate. */
export function getZonesSlots(eventId: string): Promise<ZonesSlotsData> {
  return call(() => rpc.getZonesSlots(eventId))
}

export function setSlotsStatus(
  ids: string[],
  status: 'available' | 'blocked',
  reason: string | null,
): Promise<SetSlotsStatusResult> {
  return call(() => editor.adminSetSlotsStatus(ids, status, reason))
}

export function setSlotsProps(ids: string[], patch: SlotPropsPatch): Promise<{ updated: number }> {
  return call(() => editor.adminSetSlotsProps(ids, patch))
}
