import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { listEvents, type EventListItem } from '@/features/admin/events/api'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'

const KEY = 'eventpark.adminEvent'
const listeners = new Set<() => void>()

function readSelected(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function writeSelected(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage blocked: selection lasts for this page only */
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) l()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

export type AdminEvent = {
  /** Event picked in the top bar switcher: the stored choice, else the live one, else the newest. */
  event: EventListItem | null
  eventId: string | null
  events: EventListItem[]
  isLoading: boolean
  error: unknown
  refetch: () => void
  selectEvent: (id: string) => void
}

/** Selected event for every admin page (top bar event switcher, docs 07 section 5). */
export function useAdminEvent(): AdminEvent {
  const queryClient = useQueryClient()
  const selectedId = useSyncExternalStore(subscribe, readSelected, () => null)
  const query = useQuery({ queryKey: queryKeys.events(), queryFn: listEvents, staleTime: 30_000 })

  useRealtime(['events'], () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.events() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.liveEvent() })
  })

  const events = query.data ?? []
  const event =
    events.find((e) => e.id === selectedId) ??
    events.find((e) => e.status === 'live') ??
    [...events].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ??
    null

  const selectEvent = useCallback((id: string) => writeSelected(id), [])

  return {
    event,
    eventId: event?.id ?? null,
    events,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
    selectEvent,
  }
}
