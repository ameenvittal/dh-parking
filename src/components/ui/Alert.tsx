import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva('flex w-full items-start gap-3 rounded-md border px-3 py-3 text-body lg:text-body-sm', {
  variants: {
    tone: {
      info: 'border-primary-soft bg-primary-soft text-ink',
      success: 'border-success-soft bg-success-soft text-ink',
      warning: 'border-warning-soft bg-warning-soft text-ink',
      danger: 'border-danger-soft bg-danger-soft text-ink',
    },
  },
  defaultVariants: { tone: 'info' },
})

const iconFor = {
  info: <Info size={20} strokeWidth={1.75} className="text-primary" aria-hidden="true" />,
  success: <CircleCheck size={20} strokeWidth={1.75} className="text-success" aria-hidden="true" />,
  warning: <TriangleAlert size={20} strokeWidth={1.75} className="text-warning" aria-hidden="true" />,
  danger: <CircleAlert size={20} strokeWidth={1.75} className="text-danger" aria-hidden="true" />,
} as const

type AlertProps = Omit<ComponentProps<'div'>, 'title'> &
  VariantProps<typeof alertVariants> & {
    title?: ReactNode
    icon?: ReactNode | null
    action?: ReactNode
  }

export function Alert({ className, tone = 'info', title, icon, action, children, ...props }: AlertProps) {
  const t = tone ?? 'info'
  return (
    <div role={t === 'danger' || t === 'warning' ? 'alert' : 'status'} className={cn(alertVariants({ tone }), className)} {...props}>
      {icon === null ? null : <span className="mt-0.5 shrink-0">{icon ?? iconFor[t]}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink">{children}</div> : null}
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  )
}
