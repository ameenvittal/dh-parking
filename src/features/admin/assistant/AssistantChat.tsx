import { useMutation } from '@tanstack/react-query'
import { ChevronRight, Maximize2, MessagesSquare, SendHorizontal, SquarePen, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Textarea } from '@/components/ui/Textarea'
import { Tooltip } from '@/components/ui/Tooltip'
import { useErrorText } from '@/hooks/useErrorText'
import { uid } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ADMIN_BTN } from '../components/buttonSizes'
import { askAssistant, type AssistantToolUse } from './api'

type Message = { id: string; role: 'user' | 'assistant'; content: string; tools?: AssistantToolUse[] }
const SUGGESTIONS = ['fullest', 'where', 'bikes', 'sos'] as const

type AssistantChatProps = {
  compact?: boolean
  onClose?: () => void
  className?: string
}

export function AssistantChat({ compact = false, onClose, className }: AssistantChatProps) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const [sessionId, setSessionId] = useState(uid)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const ask = useMutation({
    mutationFn: (message: string) => askAssistant({ sessionId, message, language: 'en' }),
    onSuccess: (res) => setMessages((m) => [...m, { id: uid(), role: 'assistant', content: res.reply, tools: res.tools_used }]),
    onError: (err) => toast.error(errorText(err)),
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length, ask.isPending])

  useEffect(() => {
    // Focus input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || ask.isPending) return
    setMessages((m) => [...m, { id: uid(), role: 'user', content: q }])
    setInput('')
    ask.mutate(q)
  }

  const handleReset = () => {
    setMessages([])
    setSessionId(uid())
  }

  return (
    <div className={cn('flex h-full w-full flex-col overflow-hidden', className)}>
      {/* Header bar */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b border-line bg-surface px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary-soft text-primary">
            <MessagesSquare size={16} strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-body font-semibold text-ink">{t('admin.assistant.title')}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.2 text-[11px] font-semibold text-success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content={t('admin.assistant.newChat')}>
            <button
              type="button"
              onClick={handleReset}
              aria-label={t('admin.assistant.newChat')}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          {compact ? (
            <Tooltip content={t('admin.assistant.expand', { defaultValue: 'Open full page' })}>
              <Link
                to="/admin/assistant"
                onClick={onClose}
                aria-label={t('admin.assistant.expand', { defaultValue: 'Open full page' })}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </Tooltip>
          ) : null}

          {onClose ? (
            <Tooltip content={t('common.actions.close', { defaultValue: 'Close' })}>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.actions.close', { defaultValue: 'Close' })}
                className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {/* Messages stream */}
      <div className="no-scrollbar flex flex-1 flex-col gap-3.5 overflow-y-auto p-4 bg-canvas/30" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <MessagesSquare size={22} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="text-body font-semibold text-ink">{t('admin.assistant.emptyTitle')}</p>
            <div className="flex max-w-sm flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <Chip key={s} className="h-8 px-3 text-caption" onClick={() => send(t(`admin.assistant.suggestions.${s}`))}>
                  {t(`admin.assistant.suggestions.${s}`)}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              {m.role === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-primary-soft px-3.5 py-2 text-body-sm text-ink shadow-raised">
                  {m.content}
                </div>
              ) : (
                <div className="flex w-full max-w-[96%] flex-col gap-2">
                  <div className="rounded-2xl rounded-tl-xs border border-line bg-surface p-3.5 shadow-raised">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-line bg-surface">
                            <table className="w-full border-collapse text-left text-body-sm">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="border-b border-line bg-surface-2">{children}</thead>,
                        th: ({ children, style }) => (
                          <th
                            style={style}
                            className="px-2.5 py-1.5 text-caption font-semibold text-muted whitespace-nowrap"
                          >
                            {children}
                          </th>
                        ),
                        tbody: ({ children }) => <tbody className="divide-y divide-line">{children}</tbody>,
                        tr: ({ children }) => <tr className="hover:bg-canvas transition-colors">{children}</tr>,
                        td: ({ children, style }) => (
                          <td
                            style={style}
                            className="px-2.5 py-1.5 text-body-sm text-ink tabular-nums whitespace-nowrap"
                          >
                            {children}
                          </td>
                        ),
                        p: ({ children }) => <p className="my-1 leading-relaxed text-ink text-body-sm">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                        ul: ({ children }) => <ul className="my-1 ml-4 list-disc space-y-1 text-body-sm text-ink">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1 ml-4 list-decimal space-y-1 text-body-sm text-ink">{children}</ol>,
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
            <span className="inline-block size-2 animate-pulse rounded-full bg-primary" />
            <span>{t('admin.assistant.thinking')}</span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {/* Input row */}
      <form
        className="flex shrink-0 items-end gap-2 border-t border-line bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <Textarea
          ref={inputRef}
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
          className="min-h-10 resize-none text-body-sm"
        />
        <Button
          type="submit"
          size="md"
          className={ADMIN_BTN}
          disabled={!input.trim()}
          loading={ask.isPending}
          icon={<SendHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />}
        >
          {t('admin.assistant.send')}
        </Button>
      </form>
    </div>
  )
}
