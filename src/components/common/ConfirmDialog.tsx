import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  cancelLabel?: ReactNode
  tone?: 'primary' | 'danger'
  /** May be async; the dialog shows a loading button and closes when it resolves. Throw to keep it open. */
  onConfirm: () => unknown
  confirmDisabled?: boolean
  /** Extra fields, for example a reason input or a fee row. */
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  confirmDisabled,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      /* caller shows the error; keep the dialog open */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent hideClose>
        <DialogHeader className="pr-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="secondary" size="md" className="lg:h-9 lg:px-3 lg:text-body-sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="md"
            className="lg:h-9 lg:px-3 lg:text-body-sm"
            onClick={() => void handleConfirm()}
            loading={busy}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
