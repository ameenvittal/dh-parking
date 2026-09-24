import { call } from '@/lib/demo/client'
import * as fn from '@/lib/demo/functions'
import type { DriverTokenResult } from '@/lib/demo/types'
import type { Session } from '@/types/domain'

export type { DriverTokenResult }

/** Username + password sign in. Throws BAD_CREDENTIALS or ACCOUNT_OFF. Stores the session for this tab. */
export function staffSignIn(input: { username: string; password: string }): Promise<Session> {
  return call(() => fn.staffSignIn(input.username, input.password))
}

export function signOut(): Promise<void> {
  return call(() => fn.signOut())
}

/** `/d/:token` exchange (driver-login). Throws TOKEN_INVALID or RATE_LIMITED. Stores the driver session. */
export function exchangeDriverToken(token: string): Promise<DriverTokenResult> {
  return call(() => fn.driverLogin(token))
}

/** Driver phone login (driver-resend-link). Always resolves `{ ok: true }` unless INVALID_PHONE or RATE_LIMITED. */
export function requestDriverLink(phone: string): Promise<{ ok: true }> {
  return call(() => fn.driverResendLink(phone))
}
