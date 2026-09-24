import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SlotStatus } from '@/types/domain'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime, type DemoTable } from '@/lib/realtime'
import { fetchEventMap, fetchSlotStatuses } from './api'

type UseMapDataOptions = {
  /** Staff screens need live slot colours; driver screens do not. Default true. */
  withStatuses?: boolean
}

/**
 * Event map (fetched once, refetched only on `map` changes) plus live slot statuses
 * kept fresh through realtime (docs/02 section 7).
 */
export function useMapData(eventId: string | null | undefined, { withStatuses = true }: UseMapDataOptions = {}) {
  const qc = useQueryClient()
  const id = eventId ?? ''

  const mapQuery = useQuery({
    queryKey: queryKeys.eventMap(id),
    queryFn: () => fetchEventMap(id),
    enabled: Boolean(eventId),
    staleTime: Infinity,
  })

  const statusQuery = useQuery({
    queryKey: queryKeys.slotStatuses(id),
    queryFn: () => fetchSlotStatuses(id),
    enabled: Boolean(eventId) && withStatuses,
  })

  const onChange = useCallback(
    (table: DemoTable) => {
      if (!eventId) return
      if (table === 'map') {
        void qc.invalidateQueries({ queryKey: queryKeys.eventMap(eventId) })
        return
      }
      if (withStatuses) void qc.invalidateQueries({ queryKey: queryKeys.slotStatuses(eventId) })
    },
    [qc, eventId, withStatuses],
  )
  useRealtime(withStatuses ? ['slots', 'map'] : ['map'], onChange)

  const slotStatuses = useMemo(() => {
    if (!statusQuery.data) return undefined
    const m = new Map<string, SlotStatus>()
    for (const row of statusQuery.data) m.set(row.id, row.status)
    return m
  }, [statusQuery.data])

  return {
    eventMap: mapQuery.data ?? null,
    slotStatuses,
    slotRows: statusQuery.data ?? null,
    isLoading: mapQuery.isLoading || (withStatuses && statusQuery.isLoading),
    error: mapQuery.error ?? statusQuery.error ?? null,
    refetch: () => {
      void mapQuery.refetch()
      if (withStatuses) void statusQuery.refetch()
    },
  }
}
