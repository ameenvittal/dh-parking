import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** The app icon: a blue rounded square with a white P, same as the PWA icon. */
export function BrandMark({ className, withName = true }: { className?: string; withName?: boolean }) {
  const { t } = useTranslation('common')
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary font-display text-h3 font-bold text-on-primary"
      >
        P
      </span>
      {withName ? <span className="truncate text-h3 text-ink">{t('appName')}</span> : null}
    </span>
  )
}
