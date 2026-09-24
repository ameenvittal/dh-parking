import { Skeleton } from '@/components/ui/Skeleton'

/** Shown while a page chunk or a translation namespace loads. Static blocks, no spinner. */
export function PageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-4 px-4 pt-4" aria-hidden="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-13 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  )
}
