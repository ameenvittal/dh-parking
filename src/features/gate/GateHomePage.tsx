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
import { SlotLabel } from '@/components/common/SlotLabel'
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
      <div className="flex flex-col gap-2.5">
        <Button asChild size="lg" block className="h-14 shadow-raised">
          <Link to="/gate/checkin" className="flex items-center justify-center gap-2.5">
            <Camera size={22} strokeWidth={2} aria-hidden="true" />
            <span className="font-semibold">{t('gate.home.checkIn')}</span>
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="secondary" size="lg" block>
            <Link to="/gate/exit" className="flex items-center justify-center gap-2">
              <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('gate.home.leaving')}</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" block>
            <Link to="/gate/vehicles" className="flex items-center justify-center gap-2">
              <Search size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('gate.home.find')}</span>
            </Link>
          </Button>
        </div>
      </div>

      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : null}

      <section className="flex flex-col gap-3" aria-labelledby="gate-free-now">
        <h2 id="gate-free-now" className="text-h3 text-ink">
          {t('gate.home.freeNow')}
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {types.map((type) => {
            const Icon = vehicleTypeIcon[type]
            const count = free ? free[type] : null
            return (
              <div
                key={type}
                className="flex flex-col justify-between gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-raised transition-colors hover:border-line-strong"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-md bg-surface-2 text-muted">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <span className="text-body-sm font-medium text-muted">
                    {t(`gate.home.freeType.${type}`)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="font-display text-h1 font-bold text-ink tabular-nums">
                    {count !== null ? formatNumber(count) : <Skeleton className="h-7 w-12" />}
                  </span>
                  <span className="text-caption text-muted">
                    {t('gate.home.freeNow')}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
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
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-raised">
            {overview.data.recent.map((r) => (
              <li key={r.visit_id}>
                <button
                  type="button"
                  onClick={() => setOpenVisit(r.visit_id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none transition-colors active:bg-canvas hover:bg-surface-2 focus-visible:bg-surface-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <PlateChip plate={r.plate} size="sm" />
                    {r.slot_label ? <SlotLabel size="sm" label={r.slot_label} /> : null}
                  </div>
                  <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    <span className="text-caption text-muted">{formatRelative(r.checked_in_at, t)}</span>
                  </div>
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
