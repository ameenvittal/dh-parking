import { useMutation } from '@tanstack/react-query'
import { ChevronRight, SendHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Textarea'
import { useErrorText } from '@/hooks/useErrorText'
import { uid } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ADMIN_BTN } from '../components/buttonSizes'
import { askAssistant, type AssistantToolUse } from './api'

type Message = { id: string; role: 'user' | 'assistant'; content: string; tools?: AssistantToolUse[] }
const SUGGESTIONS = ['fullest', 'where', 'bikes', 'sos'] as const

/** Assistant `/admin/assistant` (docs/07 section 5.9, F-ADM-08). Read-only answers from live data. */
export function AssistantPage() {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const [sessionId, setSessionId] = useState(uid)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const ask = useMutation({
    mutationFn: (message: string) => askAssistant({ sessionId, message, language: 'en' }),
    onSuccess: (res) => setMessages((m) => [...m, { id: uid(), role: 'assistant', content: res.reply, tools: res.tools_used }]),
    onError: (err) => toast.error(errorText(err)),
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, ask.isPending])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || ask.isPending) return
    setMessages((m) => [...m, { id: uid(), role: 'user', content: q }])
    setInput('')
    ask.mutate(q)
  }

  return (
    <div className="mx-auto flex min-h-96 w-full max-w-assistant flex-col gap-4">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="md"
          className={ADMIN_BTN}
          icon={<SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />}
          onClick={() => {
            setMessages([])
            setSessionId(uid())
          }}
        >
          {t('admin.assistant.newChat')}
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
            <p className="text-h3 text-ink">{t('admin.assistant.emptyTitle')}</p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Chip key={s} onClick={() => send(t(`admin.assistant.suggestions.${s}`))}>
                  {t(`admin.assistant.suggestions.${s}`)}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              {m.role === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary-soft px-4 py-2.5 text-body text-ink shadow-raised lg:text-body-sm">
                  {m.content}
                </div>
              ) : (
                <div className="flex w-full max-w-[96%] flex-col gap-2 sm:max-w-[90%]">
                  <div className="rounded-2xl rounded-tl-xs border border-line bg-surface p-4 shadow-raised">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="my-2.5 max-w-full overflow-x-auto rounded-lg border border-line bg-surface">
                            <table className="w-full border-collapse text-left text-body-sm">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="border-b border-line bg-surface-2">{children}</thead>,
                        th: ({ children, style }) => (
                          <th
                            style={style}
                            className="px-3 py-2 text-caption font-semibold text-muted whitespace-nowrap"
                          >
                            {children}
                          </th>
                        ),
                        tbody: ({ children }) => <tbody className="divide-y divide-line">{children}</tbody>,
                        tr: ({ children }) => <tr className="hover:bg-canvas transition-colors">{children}</tr>,
                        td: ({ children, style }) => (
                          <td
                            style={style}
                            className="px-3 py-2 text-body-sm text-ink tabular-nums whitespace-nowrap"
                          >
                            {children}
                          </td>
                        ),
                        p: ({ children }) => <p className="my-1 leading-relaxed text-ink text-body lg:text-body-sm">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                        ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-1 text-body lg:text-body-sm text-ink">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-1 text-body lg:text-body-sm text-ink">{children}</ol>,
                      }}
                    >
                      {m.content}
                    </Markdown>
                  </div>
                  {m.tools && m.tools.length > 0 ? (
                    <details className="group text-caption text-muted">
                      <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded-md px-1.5 py-1 text-caption text-muted transition-colors hover:bg-surface hover:text-ink [&::-webkit-details-marker]:hidden">
                        <ChevronRight size={13} className="text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                        <span>
                          {t('admin.assistant.used', {
                            tools: m.tools.map((tu) => t(`admin.assistant.tools.${tu.name}`, { defaultValue: tu.name })).join(', '),
                          })}
                        </span>
                      </summary>
                      <div className="mt-1 rounded-md border border-line bg-surface-2 p-2.5">
                        <ul className="flex flex-col gap-1">
                          {m.tools.map((tu, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted">
                              <span className="truncate">
                                {t('admin.assistant.toolArgs', { name: tu.name, ms: tu.ms })} {JSON.stringify(tu.args)}
                              </span>
                              <span className="shrink-0 tabular-nums text-subtle">{tu.ms} ms</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
        {ask.isPending ? (
          <div className="flex items-center gap-2 py-1 text-body-sm text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span>{t('admin.assistant.thinking')}</span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-0 flex items-end gap-2 border-t border-line bg-canvas py-3 pb-safe"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <Textarea
          aria-label={t('admin.assistant.inputLabel')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder={t('admin.assistant.placeholder')}
          rows={1}
          className="min-h-12 resize-none lg:min-h-10"
        />
        <Button type="submit" size="md" className={ADMIN_BTN} disabled={!input.trim()} loading={ask.isPending} icon={<SendHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />}>
          {t('admin.assistant.send')}
        </Button>
      </form>
    </div>
  )
}
