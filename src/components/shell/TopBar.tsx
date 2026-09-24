import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { cn } from '@/lib/utils'

type TopBarProps = {
  title?: ReactNode
  /** Small line under the title, for example the live event name. */
  subtitle?: ReactNode
  /** Shows a back button. A string navigates there; a function is called; `true` goes back in history. */
  back?: string | (() => void) | true
  /** Replaces the back button (menu button, close button). */
  leading?: ReactNode
  /** One or two icon buttons on the right. */
  trailing?: ReactNode
  /** Transparent bar floating over a full-bleed map. */
  transparent?: boolean
  className?: string
}

/** 56 px mobile top bar: title left, one or two icon buttons right (docs 06 section 5.1). */
export function TopBar({ title, subtitle, back, leading, trailing, transparent = false, className }: TopBarProps) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  const onBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') void navigate(back)
    else void navigate(-1)
  }

  return (
    <header
      className={cn(
        'z-30 pt-safe',
        transparent ? 'pointer-events-none absolute inset-x-0 top-0' : 'sticky top-0 border-b border-line bg-surface',
        className,
      )}
    >
      <div className="flex h-14 items-center gap-1 px-2">
        <div className="pointer-events-auto flex shrink-0 items-center">
          {leading ??
            (back ? (
              <button
                type="button"
                onClick={onBack}
                aria-label={t('actions.back')}
                className={cn(
                  'inline-flex size-11 items-center justify-center rounded-md text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus',
                  transparent && 'bg-surface shadow-overlay',
                )}
              >
                <ArrowLeft size={24} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null)}
        </div>
        <div className={cn('flex min-w-0 flex-1 flex-col justify-center', !leading && !back && 'pl-2')}>
          {title ? (
            <h1 className={cn('truncate text-h3 text-ink', transparent && 'sr-only')}>{title}</h1>
          ) : null}
          {subtitle ? <p className={cn('truncate text-body-sm text-muted', transparent && 'sr-only')}>{subtitle}</p> : null}
        </div>
        {trailing ? <div className="pointer-events-auto flex shrink-0 items-center gap-1">{trailing}</div> : null}
      </div>
    </header>
  )
}
