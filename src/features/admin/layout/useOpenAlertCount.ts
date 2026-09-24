import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listAlerts } from '@/features/admin/alerts/api'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'

/** Open alerts for the bell and the nav badge. `sos` is true while any SOS is open. */
export function useOpenAlertCount(eventId: string | null): { count: number; sos: boolean } {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.openAlertCount(eventId ?? ''),
    enabled: !!eventId,
    queryFn: async () => {
      const alerts = await listAlerts({ eventId: eventId ?? '', status: 'open' })
      return { count: alerts.length, sos: alerts.some((a) => a.type === 'sos') }
    },
  })
  useRealtime(['alerts'], () => {
    if (eventId) void queryClient.invalidateQueries({ queryKey: queryKeys.openAlertCount(eventId) })
  })
  return query.data ?? { count: 0, sos: false }
}
