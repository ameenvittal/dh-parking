import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLiveEvent } from '@/features/map/api'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import type { EventRow } from '@/types/domain'

export type CurrentEvent = {
  /** The live event, or null when none is live (docs 01 decision 10: one live event at a time). */
  event: EventRow | null
  isLoading: boolean
  error: unknown
  refetch: () => void
}

/** The live event for staff screens. Gate and zone show "No event is live right now" when null. */
export function useCurrentEvent(): CurrentEvent {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.liveEvent(),
    queryFn: fetchLiveEvent,
    staleTime: 30_000,
  })

  useRealtime(['events'], () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.liveEvent() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.events() })
  })

  return {
    event: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
  }
}
