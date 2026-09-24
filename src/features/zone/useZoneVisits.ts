import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { getZoneVisits } from './api'

/** get_zone_visits for the given zones, kept fresh by realtime changes on visits and alerts. */
export function useZoneVisits(zoneIds: string[], enabled = true) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.zoneVisits(zoneIds),
    queryFn: () => getZoneVisits(zoneIds.length > 0 ? zoneIds : null),
    enabled: enabled && zoneIds.length > 0,
  })
  const onChange = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['zoneVisits'] })
  }, [qc])
  useRealtime(['visits', 'alerts'], onChange)
  return query
}

/** After a zone action: refresh visit lists, slot colours and details. */
export function useZoneInvalidate() {
  const qc = useQueryClient()
  return useCallback(
    (eventId: string | null | undefined, visitId?: string) => {
      void qc.invalidateQueries({ queryKey: ['zoneVisits'] })
      if (eventId) void qc.invalidateQueries({ queryKey: queryKeys.slotStatuses(eventId) })
      if (visitId) void qc.invalidateQueries({ queryKey: queryKeys.visitDetail(visitId) })
    },
    [qc],
  )
}
