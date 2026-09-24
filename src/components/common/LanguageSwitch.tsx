import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { setLanguage } from '@/lib/i18n'
import type { Language } from '@/types/domain'

type LanguageSwitchProps = {
  /** `short` shows EN and ML for tight top bars. */
  variant?: 'full' | 'short'
  size?: 'md' | 'sm'
  className?: string
  onChange?: (lng: Language) => void
}

/** English or Malayalam, switchable any time (F-DRV-11). */
export function LanguageSwitch({ variant = 'full', size = 'md', className, onChange }: LanguageSwitchProps) {
  const { t, i18n } = useTranslation('common')
  const value: Language = i18n.resolvedLanguage === 'ml' ? 'ml' : 'en'
  const labels = variant === 'short' ? 'languagesShort' : 'languages'
  return (
    <SegmentedControl<Language>
      ariaLabel={t('language')}
      value={value}
      size={size}
      className={className}
      onChange={(lng) => {
        void setLanguage(lng)
        onChange?.(lng)
      }}
      options={[
        { value: 'en', label: <span lang="en">{t(`${labels}.en`)}</span> },
        { value: 'ml', label: <span lang="ml">{t(`${labels}.ml`)}</span> },
      ]}
    />
  )
}
