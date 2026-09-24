import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  label: string
  icon: ReactNode
  /** `float` is the map control style: surface, shadow-overlay. */
  tone?: 'ghost' | 'float' | 'danger-soft' | 'primary'
}

/** 44 × 44 icon-only button with an accessible label. */
export function IconButton({ label, icon, tone = 'ghost', className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50',
        tone === 'ghost' && 'text-ink hover:bg-surface-2',
        tone === 'float' && 'bg-surface text-ink shadow-overlay hover:bg-surface-2',
        tone === 'danger-soft' && 'bg-danger-soft text-danger',
        tone === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
