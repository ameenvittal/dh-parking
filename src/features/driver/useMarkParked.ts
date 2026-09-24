import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useErrorText } from '@/hooks/useErrorText'
import { queryKeys } from '@/lib/queryKeys'
import { markParked } from './api'
import { useDriverPrefs } from './driverPrefs'
import type { LocationFix } from './useLiveLocation'

/** driver_mark_parked with the current fix. Toast on success, mismatch remembered for the home sheet. */
export function useMarkParked(visitId: string | null, fix: LocationFix | null) {
  const { t } = useTranslation('driver')
  const qc = useQueryClient()
  const errorText = useErrorText()
  const setMismatch = useDriverPrefs((s) => s.setMismatch)
  return useMutation({
    mutationFn: () => markParked({ lng: fix?.lng ?? null, lat: fix?.lat ?? null, accuracy_m: fix?.accuracy ?? null }),
    onSuccess: (res) => {
      toast.success(t('driver.markedToast'))
      setMismatch(res.mismatch ? visitId : null)
      void qc.invalidateQueries({ queryKey: queryKeys.myVisit() })
    },
    onError: (err) => {
      toast.error(errorText(err))
    },
  })
}
