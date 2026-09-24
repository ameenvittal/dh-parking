import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/common/ErrorState'
import { IconButton } from '@/components/shell/IconButton'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { getChat, markChatRead, markMessageRead, sendInbound, type SimMessage } from './api'
import { MessageBubble } from './MessageBubble'

export function ChatView({ phone }: { phone: string }) {
  const { t } = useTranslation('sim')
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const listEnd = useRef<HTMLDivElement>(null)
  const query = useQuery({ queryKey: queryKeys.simInbox(phone), queryFn: () => getChat(phone) })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.simInbox(phone) })
    void qc.invalidateQueries({ queryKey: queryKeys.simChats() })
  }

  // The chat is open on the phone: delivered messages become read.
  const hasUnread = (query.data ?? []).some((m) => m.direction === 'out' && (m.status === 'sent' || m.status === 'delivered'))
  useEffect(() => {
    if (hasUnread) void markChatRead(phone).then(refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnread, phone])

  const count = query.data?.length ?? 0
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [count])

  const send = useMutation({
    mutationFn: (body: string) => sendInbound(phone, body),
    onSuccess: () => {
      setText('')
      refresh()
    },
  })

  const onOpenButton = (m: SimMessage) => {
    if (m.button_url) window.open(m.button_url, '_blank', 'noopener')
    void markMessageRead(m.id).then(refresh)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim() && !send.isPending) send.mutate(text.trim())
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-3 py-4">
        {query.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-28 w-4/5 rounded-lg" />
            <Skeleton className="h-20 w-3/5 rounded-lg" />
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : (
          <ul className="flex flex-col gap-3" aria-label={formatPhone(phone)}>
            {query.data.map((m) => (
              <MessageBubble key={m.id} message={m} onOpenButton={onOpenButton} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-center text-caption text-muted">{t('replyHint')}</p>
        <div ref={listEnd} />
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2 pb-safe">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('typeMessage')}
          aria-label={t('typeMessage')}
          className="flex-1"
          enterKeyHint="send"
        />
        <IconButton
          type="submit"
          tone="primary"
          label={t('send')}
          disabled={!text.trim() || send.isPending}
          icon={<SendHorizontal size={20} strokeWidth={1.75} />}
        />
      </form>
    </div>
  )
}
