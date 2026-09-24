import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { VehicleCard } from '@/components/common/VehicleCard'
import { formatRelative } from '@/lib/format'
import { ACTIVE_VISIT_STATUSES, type VisitStatus } from '@/types/domain'
import { GateFrame, type GateCtx } from './GateFrame'
import { SearchField } from './SearchField'
import { useVisitSearch } from './useVisitSearch'
import { VehicleActionSheet } from './VehicleActionSheet'

type Filter = 'active' | 'left' | 'all'
const FILTER_STATUSES: Record<Filter, VisitStatus[] | null> = {
  active: [...ACTIVE_VISIT_STATUSES],
  left: ['exited', 'cancelled'],
  all: null,
}

/** Find a vehicle (docs/07 section 3.4). */
export function GateVehiclesPage() {
  const { t } = useTranslation('gate')
  return (
    <GateFrame title={t('gate.home.find')} back="/gate">
      {(ctx) => <VehiclesView ctx={ctx} />}
    </GateFrame>
  )
}

function VehiclesView({ ctx }: { ctx: GateCtx }) {
  const { t } = useTranslation('gate')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [openVisit, setOpenVisit] = useState<string | null>(null)
  const search = useVisitSearch(ctx.event.id, query, FILTER_STATUSES[filter])
  const rows = search.data ?? []

  return (
    <>
      <SearchField value={query} onChange={setQuery} label={t('gate.search.label')} placeholder={t('gate.search.placeholder')} />
      <div className="flex gap-2" role="group" aria-label={t('gate.search.filter')}>
        {(['active', 'left', 'all'] as const).map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
            {t(`gate.search.filters.${f}`)}
          </Chip>
        ))}
      </div>

      {search.isError ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} />
      ) : search.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState className="py-8" title={t('gate.search.noResults')} description={t('gate.search.noResultsBody')} />
      ) : (
        <ul className="flex flex-col gap-3" aria-live="polite">
          {rows.map((v) => (
            <li key={v.id}>
              <VehicleCard
                plate={v.plate}
                plateSize="sm"
                status={v.status}
                vehicleType={v.vehicle_type}
                category={v.category}
                slotLabel={v.slot_label}
                time={t('gate.search.checkedInAgo', { time: formatRelative(v.checked_in_at, t) })}
                onClick={() => setOpenVisit(v.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <VehicleActionSheet
        visitId={openVisit}
        onOpenChange={(o) => (o ? undefined : setOpenVisit(null))}
        eventId={ctx.event.id}
        gateId={ctx.gate?.id ?? null}
      />
    </>
  )
}
