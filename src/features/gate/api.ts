import { extractVehicle as aiExtract } from '@/lib/demo/ai'
import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import { getPhotoUrl as photoUrl, savePhoto } from '@/lib/demo/photos'
import * as rpc from '@/lib/demo/rpc'
import type {
  ExtractResponse,
  MarkExitResult,
  PhotoUpload,
  ReassignInput,
  ReassignResult,
  ResendResult,
  SearchVisitsInput,
  SuggestSlotsInput,
} from '@/lib/demo/types'
import type {
  CheckinInput,
  CheckinResult,
  GateOverview,
  PaymentMethod,
  SuggestSlotsResult,
  VisitDetail,
  VisitSummary,
  WaMessageRow,
} from '@/types/domain'

export type {
  ExtractResponse,
  MarkExitResult,
  PhotoUpload,
  ReassignInput,
  ReassignResult,
  ResendResult,
  SearchVisitsInput,
  SuggestSlotsInput,
}

/** Compresses to max 1280 px JPEG and stores it. Pass the raw File from the camera input. */
export function uploadVehiclePhoto(eventId: string, file: Blob): Promise<PhotoUpload> {
  return call(() => savePhoto('vehicle-photos', eventId, file))
}

/** extract-vehicle. Never throws for AI problems: `error.code === 'AI_FAILED'` means open the form empty. */
export function extractVehicle(input: { eventId: string; photoPaths: string[] }): Promise<ExtractResponse> {
  return call(() => aiExtract(input.photoPaths))
}

/** Duplicate check and exit lookup. Returns null when the plate has no active visit. */
export function findActiveVisitByPlate(eventId: string, plate: string): Promise<VisitSummary | null> {
  return call(() => rpc.findActiveVisitByPlate(eventId, plate))
}

export function suggestSlots(input: SuggestSlotsInput): Promise<SuggestSlotsResult> {
  return call(() => rpc.suggestSlots(input))
}

/** gate-checkin. Throws SLOT_TAKEN, PLATE_ACTIVE, SLOT_BLOCKED, SLOT_TYPE_MISMATCH, INVALID_PHONE, NO_LIVE_EVENT. */
export function gateCheckin(input: CheckinInput): Promise<CheckinResult> {
  return call(() => fn.gateCheckin(input))
}

export function searchVisits(input: SearchVisitsInput): Promise<VisitSummary[]> {
  return call(() => rpc.searchVisits(input))
}

/** visit-reassign. Sends parking_slot_changed when `notify`. */
export function reassignVisit(input: ReassignInput): Promise<ReassignResult> {
  return call(() => fn.visitReassign(input))
}

export function cancelVisit(visitId: string, reason: string): Promise<void> {
  return call(() => rpc.cancelVisit(visitId, reason))
}

export function markExit(visitId: string, exitGateId: string | null = null): Promise<MarkExitResult> {
  return call(() => rpc.markExit(visitId, exitGateId))
}

/** driver-resend-link with the visit's phone. `message_id` is the new WhatsApp row for live status. */
export function resendDriverLink(visitId: string): Promise<ResendResult> {
  return call(() => fn.resendForVisit(visitId))
}

export function getGateOverview(eventId: string, gateId: string): Promise<GateOverview> {
  return call(() => rpc.getGateOverview(eventId, gateId))
}

export function setVisitFee(visitId: string, amount: number, method: PaymentMethod): Promise<void> {
  return call(() => rpc.setVisitFee(visitId, amount, method))
}

export function getVisitDetail(visitId: string): Promise<VisitDetail> {
  return call(() => rpc.getVisitDetail(visitId))
}

/** One WhatsApp message row (done screen status). Subscribe to realtime 'whatsapp_messages' and refetch. */
export function getWaMessage(messageId: string): Promise<WaMessageRow | null> {
  return call(() => rpc.getWaMessage(messageId))
}

/** Viewable URL for a stored photo path, or null if the photo is no longer kept. */
export function getPhotoUrl(path: string): Promise<string | null> {
  return call(() => photoUrl(path))
}
