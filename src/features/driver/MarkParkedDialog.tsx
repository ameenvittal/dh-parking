import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

type MarkParkedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotLabel: string
  onConfirm: () => Promise<unknown>
}

/** "Mark as parked?" confirm (docs/07 section 2.2). */
export function MarkParkedDialog({ open, onOpenChange, slotLabel, onConfirm }: MarkParkedDialogProps) {
  const { t } = useTranslation('driver')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('driver.markParkedTitle')}
      description={t('driver.markParkedConfirm', { slot: slotLabel })}
      confirmLabel={t('driver.markParked')}
      onConfirm={onConfirm}
    />
  )
}
