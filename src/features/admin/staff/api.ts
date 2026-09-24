import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import * as rpc from '@/lib/demo/rpc'
import type { StaffActionInput, StaffActionResult } from '@/lib/demo/types'
import type { StaffView } from '@/types/domain'

export type { StaffActionInput, StaffActionResult }

export function listStaff(): Promise<StaffView[]> {
  return call(() => rpc.listStaff())
}

/** admin-staff: create, update, deactivate, activate, reset_password. Throws USERNAME_TAKEN, BAD_REQUEST, FORBIDDEN. */
export function staffAction(input: StaffActionInput): Promise<StaffActionResult> {
  return call(() => fn.adminStaff(input))
}
