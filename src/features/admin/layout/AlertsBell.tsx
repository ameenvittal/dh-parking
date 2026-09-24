import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/** Bell with the open alert count; opens /admin/alerts. Turns danger while an SOS is open. */
export function AlertsBell({ count, sos }: { count: number; sos: boolean }) {
  const { t } = useTranslation('common')
  const label = count > 0 ? t('shell.openAlerts', { count }) : t('shell.alerts')
  return (
    <Link
      to="/admin/alerts"
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:size-9',
        sos ? 'text-danger' : 'text-ink',
      )}
    >
      <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
      {count > 0 ? (
        <span
          className={cn(
            'absolute top-1 right-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-caption leading-none tabular-nums lg:top-0 lg:-right-1',
            sos ? 'bg-danger text-on-primary' : 'bg-warning text-on-primary',
          )}
        >
          {count > 99 ? '99' : count}
        </span>
      ) : null}
    </Link>
  )
}
