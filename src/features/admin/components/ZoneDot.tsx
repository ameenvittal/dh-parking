import { zoneBgClass } from '@/components/common/statusMeta'
import { cn } from '@/lib/utils'

/** Zone colour bar used in admin lists and tables. */
export function ZoneDot({ color, className }: { color: string | null | undefined; className?: string }) {
  return <span aria-hidden="true" className={cn('h-4 w-1.5 shrink-0 rounded-xs', zoneBgClass(color), className)} />
}
