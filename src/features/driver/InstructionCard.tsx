import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type InstructionCardProps = {
  icon: LucideIcon | null
  rotateIcon?: boolean
  text: string
  secondary?: string | null
  /** drive: primary card; walk: lighter surface card (docs/07 section 2.4). */
  variant?: 'drive' | 'walk'
  className?: string
}

/** Floating instruction card at the top of the navigation map. The text is announced politely. */
export function InstructionCard({ icon: Icon, rotateIcon, text, secondary, variant = 'drive', className }: InstructionCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg px-4 py-3 shadow-overlay',
        variant === 'drive' ? 'bg-primary text-on-primary' : 'border border-line bg-surface text-ink',
        className,
      )}
    >
      {Icon ? (
        <Icon
          size={32}
          strokeWidth={1.75}
          aria-hidden="true"
          className={cn('shrink-0', rotateIcon && '-rotate-45', variant === 'walk' && 'text-primary')}
        />
      ) : null}
      <div aria-live="polite" aria-atomic="true" className="flex min-w-0 flex-col">
        <p className="text-h2">{text}</p>
        {secondary ? (
          <p className={cn('text-body', variant === 'drive' ? 'text-on-primary/85' : 'text-muted')}>{secondary}</p>
        ) : null}
      </div>
    </div>
  )
}
