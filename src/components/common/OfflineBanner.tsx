import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { cn } from '@/lib/utils'

/** Full-width warning bar under the top bar while offline (docs 06 section 6). */
export function OfflineBanner({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div role="status" className={cn('flex items-center gap-2 bg-warning-soft px-4 py-2 text-body-sm text-warning', className)}>
      <WifiOff size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      <span>{t('offline')}</span>
    </div>
  )
}
