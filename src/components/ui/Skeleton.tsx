import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Static skeleton block, no shimmer (docs 06 section 8). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('rounded-md bg-surface-2', className)} {...props} />
}
