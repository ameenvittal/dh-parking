import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime, type DemoTable } from '@/lib/realtime'
import { getMyVisit } from './api'

/** The driver's visit, kept live through realtime on visits and slots (reassignment, confirmation). */
export function useMyVisit() {
  const qc = useQueryClient()
  const query = useQuery({ queryKey: queryKeys.myVisit(), queryFn: getMyVisit })
  const onChange = useCallback(
    (table: DemoTable) => {
      if (table === 'visits' || table === 'slots' || table === 'alerts') void qc.invalidateQueries({ queryKey: queryKeys.myVisit() })
    },
    [qc],
  )
  useRealtime(['visits', 'slots', 'alerts'], onChange)
  return query
}
