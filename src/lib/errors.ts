export const ERROR_CODES = [
  'FORBIDDEN',
  'NO_LIVE_EVENT',
  'EVENT_CLOSED',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'SLOT_TYPE_MISMATCH',
  'SLOT_BLOCKED',
  'PLATE_ACTIVE',
  'INVALID_PHONE',
  'INVALID_STATE',
  'HAS_ACTIVE_VISIT',
  'GEOMETRY_INVALID',
  'OUTSIDE_ZONE',
  'OVERLAP',
  'TOKEN_INVALID',
  'RATE_LIMITED',
  'AI_FAILED',
  'WA_FAILED',
  'USERNAME_TAKEN',
  'BAD_CREDENTIALS',
  'ACCOUNT_OFF',
  'BAD_REQUEST',
  'UNKNOWN',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Error raised by the data layer. `code` is one of ERROR_CODES; `detail` carries plates or labels for messages. */
export class AppError extends Error {
  code: ErrorCode
  detail: string | null
  constructor(code: ErrorCode, detail: string | null = null) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.detail = detail
  }
}

export function errorCode(err: unknown): ErrorCode {
  if (err instanceof AppError) return err.code
  return 'UNKNOWN'
}

export function errorDetail(err: unknown): string | null {
  return err instanceof AppError ? err.detail : null
}
