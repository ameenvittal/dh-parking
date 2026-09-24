import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import * as rpc from '@/lib/demo/rpc'
import type {
  MarkParkedInput,
  MarkParkedResult,
  RaiseSosInput,
  RecordPositionInput,
  SosResult,
} from '@/lib/demo/types'
import type { DriverVisit, Language } from '@/types/domain'

export type { MarkParkedInput, MarkParkedResult, RaiseSosInput, RecordPositionInput, SosResult }

/** driver_get_my_visit. Null when the driver has no visit in the event. */
export function getMyVisit(): Promise<DriverVisit | null> {
  return call(() => rpc.driverGetMyVisit())
}

export function acceptLocationConsent(): Promise<void> {
  return call(() => rpc.driverAcceptLocationConsent())
}

export function startNavigation(): Promise<void> {
  return call(() => rpc.driverStartNavigation())
}

export function markParked(input: MarkParkedInput): Promise<MarkParkedResult> {
  return call(() => rpc.driverMarkParked(input))
}

/** Call every 15 s while sharing. Accuracy over 200 m is ignored silently. */
export function recordPosition(input: RecordPositionInput): Promise<void> {
  return call(() => rpc.recordPosition(input))
}

/** raise_sos plus alert-dispatch to admin phones. Returns the existing open SOS if there is one. */
export function raiseSos(input: RaiseSosInput): Promise<SosResult> {
  return call(() => fn.raiseSos(input))
}

/** set_my_language: stores the driver's preferred language for later messages. */
export function setMyLanguage(language: Language): Promise<void> {
  return call(() => rpc.setMyLanguage(language))
}
