import { call } from '@/lib/demo/client'
import * as editor from '@/lib/demo/editor'
import * as rpc from '@/lib/demo/rpc'
import type { RoadTrafficRow, SetSlotsStatusResult } from '@/lib/demo/types'
import type { LiveVehicle, VisitDetail } from '@/types/domain'

export type { RoadTrafficRow, SetSlotsStatusResult }

/** Active visits with a position in the last 5 minutes. */
export function getLiveVehicles(eventId: string): Promise<LiveVehicle[]> {
  return call(() => rpc.getLiveVehicles(eventId))
}

export function getRoadTraffic(eventId: string): Promise<RoadTrafficRow[]> {
  return call(() => rpc.getRoadTraffic(eventId))
}

/** For the vehicle popover trail (`trail` holds the last 200 positions). */
export function getVisitDetail(visitId: string): Promise<VisitDetail> {
  return call(() => rpc.getVisitDetail(visitId))
}

/** Slot popover Block / Unblock. */
export function setSlotsStatus(
  ids: string[],
  status: 'available' | 'blocked',
  reason: string | null,
): Promise<SetSlotsStatusResult> {
  return call(() => editor.adminSetSlotsStatus(ids, status, reason))
}
