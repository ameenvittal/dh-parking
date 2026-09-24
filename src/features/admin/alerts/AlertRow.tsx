import { useTranslation } from 'react-i18next'
import { PlateChip } from '@/components/common/PlateChip'
import { alertTypeMeta } from '@/components/common/statusMeta'
import { Badge } from '@/components/ui/Badge'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AlertView } from '@/types/domain'

type AlertRowProps = {
  alert: AlertView
  now: number
  onClick: () => void
  highlight?: boolean
  compact?: boolean
}

/** One alert: icon and type, message, plate, zone, raised by, time, status. SOS rows on danger-soft. */
export function AlertRow({ alert: a, now, onClick, highlight, compact }: AlertRowProps) {
  const { t } = useTranslation(['admin', 'common'])
  const meta = alertTypeMeta[a.type]
  const Icon = meta.icon
  const sos = a.type === 'sos' && a.status !== 'resolved'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left outline-none transition-colors duration-700 hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          sos && 'bg-danger-soft hover:bg-danger-soft',
          highlight && 'bg-warning-soft',
        )}
      >
        <span className={cn('mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md', meta.soft)}>
          <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={meta.text} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn('text-body-sm font-semibold', sos ? 'text-danger' : 'text-ink')}>{t(`admin.alertType.${a.type}`)}</span>
            {a.plate ? <PlateChip plate={a.plate} size="sm" /> : a.type === 'sos' ? <span className="text-body-sm text-ink">{t('admin.shared.driver')}</span> : null}
            {a.zone_code ? <span className="text-body-sm text-muted">{a.zone_code}</span> : null}
          </span>
          {a.message && !compact ? <span className="line-clamp-2 text-body-sm text-muted">{a.message}</span> : null}
          <span className="flex flex-wrap gap-x-3 text-caption text-muted">
            {!compact ? <span>{t('admin.alerts.raisedBy', { name: a.raised_by_label })}</span> : null}
            <span>{formatRelative(a.created_at, t, now)}</span>
          </span>
        </span>
        <Badge tone={a.status === 'open' ? (sos ? 'danger' : 'warning') : a.status === 'resolved' ? 'success' : 'neutral'}>
          {t(`admin.alertStatus.${a.status}`)}
        </Badge>
      </button>
    </li>
  )
}
