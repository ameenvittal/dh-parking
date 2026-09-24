import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'
import type { EventStatus } from '@/types/domain'
import type { AdminEvent } from './useAdminEvent'

const tone: Record<EventStatus, 'success' | 'neutral' | 'outline'> = { live: 'success', draft: 'neutral', closed: 'outline' }

type EventSwitcherProps = { admin: AdminEvent; className?: string }

/** Select with the event name and a status badge (docs 07 section 5). */
export function EventSwitcher({ admin, className }: EventSwitcherProps) {
  const { t } = useTranslation('common')
  if (admin.isLoading) return <Skeleton className={cn('h-10 w-56', className)} />
  if (!admin.events.length) return <span className={cn('text-body-sm text-muted', className)}>{t('shell.noEvents')}</span>
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <Select
        aria-label={t('shell.switchEvent')}
        className="min-w-0 lg:w-56"
        value={admin.eventId ?? ''}
        onChange={(e) => admin.selectEvent(e.target.value)}
        options={admin.events.map((ev) => ({
          value: ev.id,
          label: `${ev.name} (${t(`enums.eventStatus.${ev.status}`)})`,
        }))}
      />
      {admin.event ? (
        <Badge tone={tone[admin.event.status]} className="hidden sm:inline-flex">
          {t(`enums.eventStatus.${admin.event.status}`)}
        </Badge>
      ) : null}
    </div>
  )
}
