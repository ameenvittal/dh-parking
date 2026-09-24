import { useTranslation } from 'react-i18next'
import { formatClock } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { SimChat } from './api'
import { MessageStatus } from './MessageStatus'

type ChatListProps = {
  chats: SimChat[]
  selected: string | null
  onSelect: (phone: string) => void
}

function initials(chat: SimChat): string {
  if (chat.name) {
    const parts = chat.name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return chat.phone.slice(-2)
}

export function ChatList({ chats, selected, onSelect }: ChatListProps) {
  const { t } = useTranslation('sim')
  return (
    <ul className="divide-y divide-line">
      {chats.map((chat) => (
        <li key={chat.phone}>
          <button
            type="button"
            onClick={() => onSelect(chat.phone)}
            aria-current={selected === chat.phone ? 'true' : undefined}
            className={cn(
              'flex min-h-18 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
              selected === chat.phone && 'bg-primary-soft',
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-body-sm font-semibold text-muted"
            >
              {initials(chat)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body font-semibold text-ink">{chat.name ?? formatPhone(chat.phone)}</span>
                <time dateTime={chat.last_at} className="shrink-0 text-caption text-muted">
                  {formatClock(chat.last_at)}
                </time>
              </span>
              {chat.name ? <span className="block text-caption text-muted">{formatPhone(chat.phone)}</span> : null}
              <span className="mt-0.5 flex items-center gap-2">
                <MessageStatus status={chat.last_status} className="shrink-0" />
                <span className="truncate text-body-sm text-muted">{chat.last_body.split('\n')[0]}</span>
                {chat.unread > 0 ? (
                  <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-caption text-on-primary">
                    <span aria-hidden="true">{chat.unread}</span>
                    <span className="sr-only">{t('unread', { count: chat.unread })}</span>
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
