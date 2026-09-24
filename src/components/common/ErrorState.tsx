import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useErrorText } from '@/hooks/useErrorText'

type ErrorStateProps = {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** Query error: inline danger Alert with the mapped text and "Try again" (docs 07 section 0). */
export function ErrorState({ error, onRetry, retrying, className }: ErrorStateProps) {
  const { t } = useTranslation('common')
  const text = useErrorText()
  return (
    <Alert
      tone="danger"
      className={className}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} icon={<RotateCw size={16} strokeWidth={1.75} />}>
            {t('actions.tryAgain')}
          </Button>
        ) : null
      }
    >
      {text(error)}
    </Alert>
  )
}
