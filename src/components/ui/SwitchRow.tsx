import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Switch } from './Switch'

type SwitchRowProps = {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** Full-width tappable row with a label and a switch on the right. */
export function SwitchRow({ label, description, checked, onCheckedChange, disabled, className }: SwitchRowProps) {
  const id = useId()
  return (
    <div className={cn('flex min-h-12 items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col py-2">
        <span className="text-body text-ink lg:text-body-sm">{label}</span>
        {description ? <span className="text-body-sm text-muted">{description}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}
