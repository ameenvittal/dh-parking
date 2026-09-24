import { Check, ChevronDown, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { setLanguage } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Language } from '@/types/domain'

type LanguageDropdownProps = {
  className?: string
  onChange?: (lng: Language) => void
  /** 'full' shows "English" / "മലയാളം", 'compact' shows "EN" / "ML". Defaults to 'full'. */
  variant?: 'full' | 'compact'
}

/** English or Malayalam dropdown for top bars. */
export function LanguageDropdown({ className, onChange, variant = 'full' }: LanguageDropdownProps) {
  const { t, i18n } = useTranslation('common')
  const current: Language = i18n.resolvedLanguage === 'ml' ? 'ml' : 'en'

  const handleSelect = (lng: Language) => {
    void setLanguage(lng)
    onChange?.(lng)
  }

  const label = variant === 'compact' ? t(`languagesShort.${current}`) : t(`languages.${current}`)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language')}
        className={cn(
          'inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-body-sm font-semibold text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus',
          className,
        )}
      >
        <Globe size={18} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
        <span className="truncate">{label}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={() => handleSelect('en')}>
          <span className="flex-1 font-medium">{t('languages.en')}</span>
          {current === 'en' ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleSelect('ml')}>
          <span className="flex-1 font-medium">{t('languages.ml')}</span>
          {current === 'ml' ? <Check size={16} strokeWidth={1.75} aria-hidden="true" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
