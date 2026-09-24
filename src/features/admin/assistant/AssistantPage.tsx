import { useMutation } from '@tanstack/react-query'
import { SendHorizontal, SquarePen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
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
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
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
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'user' ? (
                <p className="max-w-4/5 rounded-lg bg-primary-soft px-4 py-2.5 text-body text-ink lg:text-body-sm">{m.content}</p>
              ) : (
                <div className="flex max-w-full flex-col gap-1">
                  <div className="text-body text-ink lg:text-body-sm [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-1.5 [&_strong]:font-semibold [&_table]:my-2 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc">
                    <Markdown>{m.content}</Markdown>
                  </div>
                  {m.tools && m.tools.length > 0 ? (
                    <details className="text-caption text-muted">
                      <summary className="cursor-pointer">
                        {t('admin.assistant.used', {
                          tools: m.tools.map((tu) => t(`admin.assistant.tools.${tu.name}`, { defaultValue: tu.name })).join(', '),
                        })}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                        {m.tools.map((tu, i) => (
                          <li key={i} className="font-mono">
                            {t('admin.assistant.toolArgs', { name: tu.name, ms: tu.ms })} {JSON.stringify(tu.args)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
        {ask.isPending ? <p className="text-body-sm text-muted">{t('admin.assistant.thinking')}</p> : null}
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
