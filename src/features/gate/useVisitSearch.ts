import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import type { VisitStatus } from '@/types/domain'
import { searchVisits } from './api'

/** search_visits with a 300 ms debounce (docs/07 section 3.3), kept fresh by realtime visit changes. */
export function useVisitSearch(eventId: string, query: string, statuses: VisitStatus[] | null) {
  const [debounced, setDebounced] = useState(query)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(id)
  }, [query])
  const statusKey = statuses ? statuses.join(',') : 'all'
  const result = useQuery({
    queryKey: queryKeys.searchVisits(eventId, debounced, statusKey),
    queryFn: () => searchVisits({ eventId, query: debounced, status: statuses, limit: 30 }),
    placeholderData: (prev) => prev,
  })
  useRealtime(['visits'], () => void result.refetch())
  return { ...result, debouncedQuery: debounced }
}
