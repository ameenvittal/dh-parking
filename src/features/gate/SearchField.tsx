import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/Input'

type SearchFieldProps = { value: string; onChange: (v: string) => void; placeholder: string; label: string; autoFocus?: boolean }

/** Plate or last-4 search box with a clear button. */
export function SearchField({ value, onChange, placeholder, label, autoFocus }: SearchFieldProps) {
  const { t } = useTranslation('gate')
  return (
    <div className="relative">
      <Search size={20} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        inputMode="search"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="pr-12 pl-10 uppercase placeholder:normal-case"
      />
      {value ? (
        <button
          type="button"
          aria-label={t('common.actions.clear')}
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
        >
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
