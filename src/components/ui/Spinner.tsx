import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpinnerProps = { className?: string; size?: 16 | 20 | 24 }

export function Spinner({ className, size = 20 }: SpinnerProps) {
  return (
    <LoaderCircle
      aria-hidden="true"
      size={size}
      strokeWidth={1.75}
      className={cn('shrink-0 animate-spin motion-reduce:animate-none', className)}
    />
  )
}
