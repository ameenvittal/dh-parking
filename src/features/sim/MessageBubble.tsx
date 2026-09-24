import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SimMessage } from './api'
import { MessageStatus } from './MessageStatus'

type MessageBubbleProps = {
  message: SimMessage
  onOpenButton: (message: SimMessage) => void
}

/**
 * The simulator shows the driver's phone: messages from the business arrive on the left,
 * what the driver types goes on the right.
 */
export function MessageBubble({ message, onOpenButton }: MessageBubbleProps) {
  const { t } = useTranslation('sim')
  const fromBusiness = message.direction === 'out'
  return (
    <li className={cn('flex', fromBusiness ? 'justify-start' : 'justify-end')}>
      <div
        lang={message.language}
        className={cn(
          'max-w-11/12 overflow-hidden rounded-lg border shadow-raised',
          fromBusiness ? 'rounded-tl-xs border-line bg-surface' : 'rounded-tr-xs border-success-soft bg-success-soft',
        )}
      >
        <p className="px-3 pt-2 text-body-sm whitespace-pre-line break-words text-ink">{message.body}</p>
        <div className="flex items-center justify-end gap-2 px-3 pt-1 pb-2 text-caption text-muted">
          <time dateTime={message.created_at}>{formatClock(message.created_at)}</time>
          {fromBusiness ? <MessageStatus status={message.status} /> : null}
        </div>
        {message.status === 'failed' && message.error_code ? (
          <p className="border-t border-line bg-danger-soft px-3 py-2 text-caption text-danger">
            {t('failedHint', { code: message.error_code })}
          </p>
        ) : null}
        {message.button_label && message.button_url && message.status !== 'failed' ? (
          <button
            type="button"
            onClick={() => onOpenButton(message)}
            className="flex h-12 w-full items-center justify-center gap-2 border-t border-line text-body-sm font-semibold text-primary hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
          >
            <ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" />
            {message.button_label}
          </button>
        ) : null}
      </div>
    </li>
  )
}
