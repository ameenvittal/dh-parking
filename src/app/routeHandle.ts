/** `handle` on admin routes: the top bar title key and whether content is full-bleed (maps). */
export type AdminRouteHandle = { titleKey: string; fullBleed?: boolean }

export function isAdminRouteHandle(v: unknown): v is AdminRouteHandle {
  return !!v && typeof v === 'object' && 'titleKey' in v && typeof v.titleKey === 'string'
}
