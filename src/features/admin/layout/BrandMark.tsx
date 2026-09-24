import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** The app logo: Darul Huda Islamic University emblem from /logoonly.png. */
export function BrandMark({ className, withName = true }: { className?: string; withName?: boolean }) {
  const { t } = useTranslation('common')
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <img
        src="/logoonly.png"
        alt=""
        aria-hidden="true"
        className="size-8 shrink-0 object-contain"
      />
      {withName ? <span className="truncate text-h3 text-ink">{t('appName')}</span> : null}
    </span>
  )
}
