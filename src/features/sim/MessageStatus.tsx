import { Check, CheckCheck, CircleAlert, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { WaStatus } from '@/types/domain'

const ICON = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const

/** WhatsApp style ticks with a text label for screen readers (and visible text when failed). */
export function MessageStatus({ status, className }: { status: WaStatus; className?: string }) {
  const { t } = useTranslation('sim')
  const label = t(`status.${status}`)
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {status === 'queued' ? <Clock {...ICON} className="text-subtle" /> : null}
      {status === 'sent' ? <Check {...ICON} className="text-muted" /> : null}
      {status === 'delivered' ? <CheckCheck {...ICON} className="text-muted" /> : null}
      {status === 'read' ? <CheckCheck {...ICON} className="text-primary" /> : null}
      {status === 'failed' ? <CircleAlert {...ICON} className="text-danger" /> : null}
      <span className={status === 'failed' ? 'text-danger' : 'sr-only'}>{label}</span>
    </span>
  )
}
