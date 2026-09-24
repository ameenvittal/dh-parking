import { Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '@/components/shell/IconButton'

/** Top bar SOS trigger: 44 × 44, danger soft, `aria-label="SOS"` (docs/07 section 2.5). */
export function SosButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation('driver')
  return (
    <IconButton
      label={t('driver.sos.label')}
      tone="danger-soft"
      onClick={onClick}
      className={className}
      icon={<Siren size={24} strokeWidth={1.75} aria-hidden="true" />}
    />
  )
}
