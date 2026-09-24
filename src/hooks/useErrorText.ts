import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { errorCode, errorDetail } from '@/lib/errors'

/** Maps any thrown value to the translated `errors.<CODE>` text (docs 02 section 9). */
export function useErrorText(): (err: unknown) => string {
  const { t } = useTranslation('errors')
  return useCallback(
    (err: unknown) => {
      const code = errorCode(err)
      return t(`errors.${code}`, { detail: errorDetail(err) ?? '' })
    },
    [t],
  )
}
