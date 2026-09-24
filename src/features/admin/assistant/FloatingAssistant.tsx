import { MessagesSquare, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { AssistantChat } from './AssistantChat'

/** Floating assistant icon at bottom right of the admin portal with toggleable chat widget. */
export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const { t } = useTranslation(['admin', 'common'])

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  // Don't render floating assistant on the dedicated full-page route
  if (location.pathname === '/admin/assistant') {
    return null
  }

  return (
    <>
      {isOpen ? (
        <div
          role="dialog"
          aria-label={t('admin.assistant.title')}
          aria-modal="false"
          className="fixed bottom-20 inset-x-3 z-50 flex h-[540px] max-h-[calc(100vh-6.5rem)] flex-col rounded-2xl border border-line bg-surface shadow-overlay sm:inset-x-auto sm:right-6 sm:bottom-22 sm:w-[420px] sm:max-h-[calc(100vh-7rem)] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <AssistantChat compact onClose={() => setIsOpen(false)} />
        </div>
      ) : null}

      <div className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6">
        <Tooltip content={isOpen ? t('common.actions.close', { defaultValue: 'Close' }) : t('admin.assistant.title')} side="left">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? t('common.actions.close', { defaultValue: 'Close' }) : t('admin.assistant.title')}
            aria-expanded={isOpen}
            className={cn(
              'flex size-12 items-center justify-center rounded-full shadow-overlay transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus active:scale-95 lg:size-13',
              isOpen
                ? 'border border-line bg-surface text-ink hover:bg-surface-2'
                : 'bg-primary text-on-primary hover:bg-primary-hover',
            )}
          >
            {isOpen ? (
              <X size={22} strokeWidth={2} aria-hidden="true" />
            ) : (
              <MessagesSquare size={22} strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      </div>
    </>
  )
}
