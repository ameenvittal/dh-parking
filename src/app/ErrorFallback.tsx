import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

type ErrorFallbackProps = { onReload?: () => void }

/** Full-page crash screen, used by ErrorBoundary and the router errorElement. */
export function ErrorFallback({ onReload }: ErrorFallbackProps) {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="text-h2 text-ink">{t('errorBoundary.title')}</h1>
      <p className="max-w-80 text-body text-muted">{t('errorBoundary.body')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={onReload ?? (() => window.location.reload())}>
          {t('actions.reload')}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => window.location.assign('/')}>
          {t('errorBoundary.home')}
        </Button>
      </div>
    </div>
  )
}
