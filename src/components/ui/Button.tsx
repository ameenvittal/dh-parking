import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98]',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2 active:scale-[0.98]',
        ghost: 'bg-transparent text-ink hover:bg-surface-2 active:scale-[0.98]',
        danger: 'bg-danger text-on-primary hover:opacity-90 active:scale-[0.98]',
        'danger-ghost': 'bg-transparent text-danger hover:bg-danger-soft active:scale-[0.98]',
        'danger-soft': 'bg-danger-soft text-danger hover:bg-danger-soft active:opacity-90',
        link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        lg: 'h-13 px-5 text-body font-semibold',
        md: 'h-11 px-4 text-body font-semibold',
        sm: 'h-9 px-3 text-body-sm font-semibold',
        icon: 'size-11 lg:size-9',
        'icon-lg': 'size-11',
        'icon-sm': 'size-9',
      },
      block: { true: 'w-full', false: '' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    /** Leading icon. Replaced by a spinner while loading. */
    icon?: ReactNode
  }

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  icon,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, block }), className)
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' || size === 'icon-sm' ? 16 : 20} /> : icon}
      {children}
    </button>
  )
}
