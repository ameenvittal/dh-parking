import { call } from '@/lib/demo/client'
import * as rpc from '@/lib/demo/rpc'
import type { ActivityItem, DashboardSummary } from '@/types/domain'

export function getDashboardSummary(eventId: string): Promise<DashboardSummary> {
  return call(() => rpc.getDashboardSummary(eventId))
}

export function getRecentActivity(eventId: string, limit = 30): Promise<ActivityItem[]> {
  return call(() => rpc.getRecentActivity(eventId, limit))
}
