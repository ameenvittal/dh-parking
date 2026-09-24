import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, LogOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PlateChip } from '@/components/common/PlateChip'
import { StatusBadge } from '@/components/common/StatusBadge'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { formatNumber, formatRelative } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import type { VehicleType } from '@/types/domain'
import { getGateOverview } from './api'
import { GateFrame, type GateCtx } from './GateFrame'
import { useDebouncedRealtime } from './useDebouncedRealtime'
import { VehicleActionSheet } from './VehicleActionSheet'

const FREE_TYPES: VehicleType[] = ['car', 'bike', 'ev', 'bus']

/** Gate home (docs/07 section 3.1). */
export function GateHomePage() {
  return <GateFrame>{(ctx) => <GateHome ctx={ctx} />}</GateFrame>
}

function GateHome({ ctx }: { ctx: GateCtx }) {
  const { t } = useTranslation('gate')
  const qc = useQueryClient()
  const [openVisit, setOpenVisit] = useState<string | null>(null)
  const eventId = ctx.event.id
  const gateId = ctx.gate?.id ?? ''

  const overview = useQuery({
    queryKey: queryKeys.gateOverview(eventId, gateId),
    queryFn: () => getGateOverview(eventId, gateId),
    enabled: Boolean(gateId),
  })
  useDebouncedRealtime(['slots', 'visits'], () => {
    void qc.invalidateQueries({ queryKey: queryKeys.gateOverview(eventId, gateId) })
  })

  const free = overview.data?.free_by_type
  const types = free && free.other > 0 ? [...FREE_TYPES, 'other' as const] : FREE_TYPES

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button asChild size="lg" block>
          <Link to="/gate/checkin">
            <Camera size={20} strokeWidth={1.75} aria-hidden="true" />
            {t('gate.home.checkIn')}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" block>
          <Link to="/gate/exit">
            <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
            {t('gate.home.leaving')}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg" block>
          <Link to="/gate/vehicles">
            <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            {t('gate.home.find')}
          </Link>
        </Button>
      </div>

      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : null}

      <section className="flex flex-col gap-3" aria-labelledby="gate-free-now">
        <h2 id="gate-free-now" className="text-h3 text-ink">
          {t('gate.home.freeNow')}
        </h2>
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface">
          {types.map((type, i) => {
            const Icon = vehicleTypeIcon[type]
            return (
              <div
                key={type}
                className={[
                  'flex items-center gap-3 px-4 py-3',
                  i % 2 === 1 ? 'border-l border-line' : '',
                  i >= 2 ? 'border-t border-line' : '',
                ].join(' ')}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
                <dt className="flex-1 text-body text-muted">{t(`gate.home.freeType.${type}`)}</dt>
                <dd className="font-display text-h2 text-ink tabular-nums">
                  {free ? formatNumber(free[type]) : <Skeleton className="h-6 w-8" />}
                </dd>
              </div>
            )
          })}
        </dl>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="gate-recent">
        <h2 id="gate-recent" className="text-h3 text-ink">
          {t('gate.home.lastCheckins')}
        </h2>
        {overview.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : overview.data && overview.data.recent.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {overview.data.recent.map((r) => (
              <li key={r.visit_id}>
                <button
                  type="button"
                  onClick={() => setOpenVisit(r.visit_id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left outline-none active:bg-canvas focus-visible:bg-surface-2"
                >
                  <PlateChip plate={r.plate} size="sm" />
                  <span className="font-display text-h3 font-bold text-ink tabular-nums">{r.slot_label ?? ''}</span>
                  <span className="ml-auto flex flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    <span className="text-caption text-muted">{formatRelative(r.checked_in_at, t)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t('gate.home.noCheckins')} description={t('gate.home.noCheckinsBody')} className="py-6" />
        )}
      </section>

      <VehicleActionSheet
        visitId={openVisit}
        onOpenChange={(o) => (o ? undefined : setOpenVisit(null))}
        eventId={eventId}
        gateId={ctx.gate?.id ?? null}
      />
    </>
  )
}
