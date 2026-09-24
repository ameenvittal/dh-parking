import { useTranslation } from 'react-i18next'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VisitEventRow } from '@/types/domain'

type VisitTimelineProps = {
  events: VisitEventRow[]
  /** Show who did it (admin drawer). */
  actorName?: (e: VisitEventRow) => string | null
  className?: string
}

function str(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : ''
}

/** Label params from `visit_events.data`, tolerant of the key names used by the backend. */
function params(e: VisitEventRow): Record<string, string> {
  const d = e.data
  return {
    slot: str(d.label ?? d.slot_label ?? d.new_label ?? d.to),
    from: str(d.from ?? d.old_label ?? d.from_label ?? d.old),
    to: str(d.to ?? d.new_label ?? d.to_label ?? d.new ?? d.label),
  }
}

/** Visit audit trail, newest last, with times in IST (F-AUDIT-01). */
export function VisitTimeline({ events, actorName, className }: VisitTimelineProps) {
  const { t } = useTranslation(['zone', 'admin'])
  if (events.length === 0) return <p className="text-body-sm text-muted">{t('zone.detail.noTimeline')}</p>
  const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return (
    <ol className={cn('flex flex-col', className)}>
      {sorted.map((e, i) => {
        const actor = actorName?.(e)
        return (
          <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
            <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
              <span className="mt-1.5 size-2.5 rounded-full bg-line-strong" />
              {i < sorted.length - 1 ? <span className="absolute top-4 bottom-0 w-px bg-line" /> : null}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-body text-ink lg:text-body-sm">{t(`zone.timeline.${e.type}`, params(e))}</span>
              <span className="flex shrink-0 gap-2 text-body-sm text-muted tabular-nums">
                {actor ? <span>{t('admin.timeline.by', { actor })}</span> : null}
                <time dateTime={e.created_at}>{formatClock(e.created_at)}</time>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
