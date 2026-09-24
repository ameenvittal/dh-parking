import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import type { EventListItem } from '@/lib/demo/types'
import { useAdminEvent } from '../layout/useAdminEvent'

/** Renders children with the event picked in the top bar, or a loading, error or empty state. */
export function RequireEvent({ children }: { children: (event: EventListItem) => ReactNode }) {
  const { t } = useTranslation(['admin', 'common'])
  const { event, isLoading, error, refetch } = useAdminEvent()
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (!event) {
    return (
      <EmptyState
        title={t('admin.shared.noLiveEvent')}
        description={t('admin.shared.noLiveEventBody')}
        action={
          <Button asChild variant="secondary" size="md">
            <Link to="/admin/events">{t('admin.shared.openEvents')}</Link>
          </Button>
        }
      />
    )
  }
  return <>{children(event)}</>
}
