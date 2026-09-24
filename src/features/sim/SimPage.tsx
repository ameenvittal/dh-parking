import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { IconButton } from '@/components/shell/IconButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { APP_NAME } from '@/config/app'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import { listChats } from './api'
import { ChatList } from './ChatList'
import { ChatView } from './ChatView'

/**
 * /sim: the WhatsApp simulator (demo mode, PRD decision 16). It stands in for the drivers'
 * phones: every message the app "sends" shows up here, ticks move live, and the template
 * button opens the /d/<token> link in a new tab like WhatsApp would.
 * Phone frame on wide screens, full screen on phones. `?phone=+91...` opens one chat.
 */
export function SimPage() {
  const { t } = useTranslation('sim')
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const phone = params.get('phone')
  const chats = useQuery({ queryKey: queryKeys.simChats(), queryFn: listChats })

  useRealtime(['whatsapp_messages'], () => {
    void qc.invalidateQueries({ queryKey: queryKeys.simChats() })
    if (phone) void qc.invalidateQueries({ queryKey: queryKeys.simInbox(phone) })
  })

  const select = (p: string | null) => setParams(p ? { phone: p } : {}, { replace: false })
  const current = chats.data?.find((c) => c.phone === phone) ?? null

  return (
    <div className="min-h-app bg-canvas sm:px-4 sm:py-8">
      <div className="mx-auto hidden max-w-100 pb-4 sm:block">
        <h1 className="text-h2 text-ink">{t('title')}</h1>
        <p className="mt-1 text-body-sm text-muted">{t('subtitle')}</p>
      </div>

      <section
        aria-label={t('title')}
        className="mx-auto flex h-app w-full max-w-100 flex-col overflow-hidden bg-surface sm:h-190 sm:rounded-xl sm:border sm:border-line-strong sm:shadow-overlay"
      >
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 pt-safe">
          {phone ? (
            <IconButton label={t('backToChats')} icon={<ArrowLeft size={22} strokeWidth={1.75} />} onClick={() => select(null)} />
          ) : (
            <span className="flex size-11 items-center justify-center text-primary" aria-hidden="true">
              <MessageCircle size={24} strokeWidth={1.75} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-body font-semibold text-ink">
              {phone ? (current?.name ?? formatPhone(phone)) : t('chats')}
            </p>
            <p className="truncate text-caption text-muted">
              {phone ? (current?.name ? formatPhone(phone) : t('business', { name: APP_NAME })) : t('business', { name: APP_NAME })}
            </p>
          </div>
        </header>

        {phone ? (
          <ChatView key={phone} phone={phone} />
        ) : (
          <div className={cn('min-h-0 flex-1 overflow-y-auto')}>
            {chats.isPending ? (
              <div className="flex flex-col gap-4 p-4" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-4/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chats.isError ? (
              <ErrorState className="m-4" error={chats.error} onRetry={() => void chats.refetch()} retrying={chats.isFetching} />
            ) : chats.data.length === 0 ? (
              <EmptyState className="m-4" title={t('empty.title')} description={t('empty.body')} />
            ) : (
              <ChatList chats={chats.data} selected={phone} onSelect={select} />
            )}
            <p className="px-4 py-4 text-caption text-muted">{t('demoNote')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
