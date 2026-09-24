import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

/** After an admin action: refetch everything except the (static) event map. Realtime covers other tabs. */
export function useAdminRefresh() {
  const qc = useQueryClient()
  return useCallback(() => {
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'eventMap' })
  }, [qc])
}
