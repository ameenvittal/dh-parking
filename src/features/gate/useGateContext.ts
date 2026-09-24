import { useCurrentEvent } from '@/hooks/useCurrentEvent'
import { useMapData } from '@/features/map/useMapData'
import { useGateSelection } from './useGateSelection'

/** Live event, its map, and the selected gate: what every gate screen needs. */
export function useGateContext({ withStatuses = false }: { withStatuses?: boolean } = {}) {
  const current = useCurrentEvent()
  const event = current.event
  const map = useMapData(event?.id, { withStatuses })
  const selection = useGateSelection(map.eventMap)
  return {
    event,
    eventMap: map.eventMap,
    slotStatuses: map.slotStatuses,
    ...selection,
    isLoading: current.isLoading || (Boolean(event) && map.isLoading),
    error: current.error ?? map.error,
    refetch: () => {
      current.refetch()
      map.refetch()
    },
  }
}
