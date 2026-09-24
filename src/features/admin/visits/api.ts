import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import { getPhotoUrl as photoUrl } from '@/lib/demo/photos'
import * as rpc from '@/lib/demo/rpc'
import type {
  ConfirmParkedResult,
  MarkExitResult,
  ReassignInput,
  ReassignResult,
  ResendResult,
  VisitListFilters,
} from '@/lib/demo/types'
import type { VisitDetail, VisitSummary } from '@/types/domain'

export type { ConfirmParkedResult, MarkExitResult, ReassignInput, ReassignResult, ResendResult, VisitListFilters }

/** Vehicles table. Sorted by checked in, newest first. The client pages (50 per page). */
export function listVisits(filters: VisitListFilters): Promise<VisitSummary[]> {
  return call(() => rpc.listVisits(filters))
}

export function getVisitDetail(visitId: string): Promise<VisitDetail> {
  return call(() => rpc.getVisitDetail(visitId))
}

export function reassignVisit(input: ReassignInput): Promise<ReassignResult> {
  return call(() => fn.visitReassign(input))
}

export function resendDriverLink(visitId: string): Promise<ResendResult> {
  return call(() => fn.resendForVisit(visitId))
}

export function markExit(visitId: string): Promise<MarkExitResult> {
  return call(() => rpc.markExit(visitId, null))
}

export function cancelVisit(visitId: string, reason: string): Promise<void> {
  return call(() => rpc.cancelVisit(visitId, reason))
}

export function confirmParked(visitId: string): Promise<ConfirmParkedResult> {
  return call(() => rpc.zoneConfirmParked({ visitId }))
}

export function getPhotoUrl(path: string): Promise<string | null> {
  return call(() => photoUrl(path))
}
