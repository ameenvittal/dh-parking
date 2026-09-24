import { call } from '@/lib/demo/client'
import * as editor from '@/lib/demo/editor'
import type {
  OverlayRow,
  RoadNetworkInput,
  SetSlotsStatusResult,
  SlotInput,
  SlotPropsPatch,
  UpsertGateInput,
  UpsertLandmarkInput,
  UpsertOverlayInput,
  UpsertZoneInput,
} from '@/lib/demo/types'
import type { GateRow, LandmarkRow, SlotRow, ZoneRow } from '@/types/domain'

export type {
  OverlayRow,
  RoadNetworkInput,
  SetSlotsStatusResult,
  SlotInput,
  SlotPropsPatch,
  UpsertGateInput,
  UpsertLandmarkInput,
  UpsertOverlayInput,
  UpsertZoneInput,
}

/*
 * admin_* editor RPCs. Each validates geometry like the server would and throws
 * GEOMETRY_INVALID, OUTSIDE_ZONE (detail: labels), OVERLAP (detail: labels) or
 * HAS_ACTIVE_VISIT (detail: plates). Successful saves notify the 'map' realtime table,
 * so there is no separate map-updated broadcast to send.
 */

export function upsertGate(input: UpsertGateInput): Promise<GateRow> {
  return call(() => editor.adminUpsertGate(input))
}

export function deleteGate(id: string): Promise<void> {
  return call(() => editor.adminDeleteGate(id))
}

export function upsertZone(input: UpsertZoneInput): Promise<ZoneRow> {
  return call(() => editor.adminUpsertZone(input))
}

export function deleteZone(id: string): Promise<void> {
  return call(() => editor.adminDeleteZone(id))
}

export function upsertSlots(zoneId: string, slots: SlotInput[]): Promise<SlotRow[]> {
  return call(() => editor.adminUpsertSlots(zoneId, slots))
}

export function deleteSlots(ids: string[]): Promise<void> {
  return call(() => editor.adminDeleteSlots(ids))
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

export function saveRoadNetwork(input: RoadNetworkInput): Promise<{ nodes: number; segments: number }> {
  return call(() => editor.adminSaveRoadNetwork(input))
}

export function upsertLandmark(input: UpsertLandmarkInput): Promise<LandmarkRow> {
  return call(() => editor.adminUpsertLandmark(input))
}

export function deleteLandmark(id: string): Promise<void> {
  return call(() => editor.adminDeleteLandmark(id))
}

export function listOverlays(eventId: string): Promise<OverlayRow[]> {
  return call(() => editor.listOverlays(eventId))
}

export function upsertOverlay(input: UpsertOverlayInput): Promise<OverlayRow> {
  return call(() => editor.adminUpsertOverlay(input))
}

export function deleteOverlay(id: string): Promise<void> {
  return call(() => editor.adminDeleteOverlay(id))
}
