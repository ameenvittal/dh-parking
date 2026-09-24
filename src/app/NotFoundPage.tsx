import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="text-h2 text-ink">{t('notFound.title')}</h1>
      <p className="max-w-80 text-body text-muted">{t('notFound.body')}</p>
      <Button asChild size="lg" className="mt-3">
        <Link to="/">{t('notFound.home')}</Link>
      </Button>
    </div>
  )
}
