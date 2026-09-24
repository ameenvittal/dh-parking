import { call } from '@/lib/demo/client'
import { getPhotoUrl as photoUrl } from '@/lib/demo/photos'
import * as rpc from '@/lib/demo/rpc'
import type { AlertFilters } from '@/lib/demo/types'
import type { AlertStatus, AlertView } from '@/types/domain'

export type { AlertFilters }

/** Alerts inbox. SOS first, then newest first. */
export function listAlerts(filters: AlertFilters): Promise<AlertView[]> {
  return call(() => rpc.listAlerts(filters))
}

export function getAlert(alertId: string): Promise<AlertView> {
  return call(() => rpc.getAlert(alertId))
}

/** update_alert: open to acknowledged to resolved, or open to resolved. */
export function updateAlert(alertId: string, status: AlertStatus, note: string | null = null): Promise<void> {
  return call(() => rpc.updateAlert(alertId, status, note))
}

export function getPhotoUrl(path: string): Promise<string | null> {
  return call(() => photoUrl(path))
}
