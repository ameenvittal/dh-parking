import { call } from '@/lib/demo/client'
import { getPhotoUrl as photoUrl, savePhoto } from '@/lib/demo/photos'
import * as rpc from '@/lib/demo/rpc'
import type {
  ConfirmParkedInput,
  ConfirmParkedResult,
  MarkExitResult,
  PhotoUpload,
  ReportWrongParkingInput,
} from '@/lib/demo/types'
import type { VisitDetail, ZoneVisit } from '@/types/domain'

export type { ConfirmParkedInput, ConfirmParkedResult, MarkExitResult, PhotoUpload, ReportWrongParkingInput }

/** get_zone_visits. Null means the volunteer's own zones. Admin may pass any zones. */
export function getZoneVisits(zoneIds: string[] | null = null): Promise<ZoneVisit[]> {
  return call(() => rpc.getZoneVisits(zoneIds))
}

/** zone_confirm_parked. With `actualSlotId` this is the wrong slot correction. */
export function confirmParked(input: ConfirmParkedInput): Promise<ConfirmParkedResult> {
  return call(() => rpc.zoneConfirmParked(input))
}

export function flagNotHere(visitId: string): Promise<void> {
  return call(() => rpc.zoneFlagNotHere(visitId))
}

export function reportWrongParking(input: ReportWrongParkingInput): Promise<{ alert_id: string }> {
  return call(() => rpc.reportWrongParking(input))
}

export function uploadAlertPhoto(eventId: string, file: Blob): Promise<PhotoUpload> {
  return call(() => savePhoto('alert-photos', eventId, file))
}

export function markExit(visitId: string): Promise<MarkExitResult> {
  return call(() => rpc.markExit(visitId, null))
}

/** Visit detail for the zone screen. Phone is masked for zone volunteers. */
export function getVisitDetail(visitId: string): Promise<VisitDetail> {
  return call(() => rpc.getVisitDetail(visitId))
}

export function getPhotoUrl(path: string): Promise<string | null> {
  return call(() => photoUrl(path))
}
