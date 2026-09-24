import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { VehicleCard } from '@/components/common/VehicleCard'
import { useErrorText } from '@/hooks/useErrorText'
import { formatPlate, formatRelative } from '@/lib/format'
import { ACTIVE_VISIT_STATUSES, type VisitStatus, type VisitSummary } from '@/types/domain'
import { extractVehicle, markExit, uploadVehiclePhoto } from './api'
import { GateFrame, type GateCtx } from './GateFrame'
import { SearchField } from './SearchField'
import { useVisitSearch } from './useVisitSearch'

const ACTIVE: VisitStatus[] = [...ACTIVE_VISIT_STATUSES]

/** Vehicle leaving (docs/07 section 3.3). */
export function ExitPage() {
  const { t } = useTranslation('gate')
  return (
    <GateFrame title={t('gate.home.leaving')} back="/gate">
      {(ctx) => <ExitView ctx={ctx} />}
    </GateFrame>
  )
}

function ExitView({ ctx }: { ctx: GateCtx }) {
  const { t } = useTranslation('gate')
  const errorText = useErrorText()
  const [query, setQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [target, setTarget] = useState<VisitSummary | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const search = useVisitSearch(ctx.event.id, query, ACTIVE)

  const onScan = async (file: File | undefined) => {
    if (!file) return
    setScanning(true)
    try {
      const up = await uploadVehiclePhoto(ctx.event.id, file)
      const res = await extractVehicle({ eventId: ctx.event.id, photoPaths: [up.path] })
      if (res.result?.plate) setQuery(res.result.plate)
      else toast.error(t('errors.AI_FAILED'))
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setScanning(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const doExit = async () => {
    if (!target) return
    try {
      await markExit(target.id, ctx.gate?.id ?? null)
      toast.success(t('gate.exit.marked'))
      void search.refetch()
    } catch (err) {
      toast.error(errorText(err))
      throw err
    }
  }

  const rows = search.data ?? []
  const hasQuery = search.debouncedQuery.length > 0

  return (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        label={t('gate.search.label')}
        placeholder={t('gate.search.placeholder')}
        autoFocus
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => void onScan(e.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="md"
        block
        loading={scanning}
        icon={<ScanLine size={20} strokeWidth={1.75} aria-hidden="true" />}
        onClick={() => fileRef.current?.click()}
      >
        {scanning ? t('gate.photo.reading') : t('gate.exit.scan')}
      </Button>

      {search.isError ? (
        <ErrorState error={search.error} onRetry={() => void search.refetch()} />
      ) : search.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="py-8"
          title={hasQuery ? t('gate.search.noActive') : t('gate.exit.emptyTitle')}
          description={hasQuery ? t('gate.search.noResultsBody') : t('gate.exit.emptyBody')}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-live="polite">
          {rows.map((v) => (
            <li key={v.id}>
              <VehicleCard
                plate={v.plate}
                status={v.status}
                vehicleType={v.vehicle_type}
                color={v.vehicle_color}
                make={v.vehicle_make}
                category={v.category}
                slotLabel={v.slot_label}
                time={t('gate.search.checkedInAgo', { time: formatRelative(v.checked_in_at, t) })}
                actions={
                  <Button size="sm" onClick={() => setTarget(v)}>
                    {t('gate.exit.markExit')}
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => (o ? undefined : setTarget(null))}
        title={t('gate.exit.confirmTitle', { plate: target ? formatPlate(target.plate) : '' })}
        confirmLabel={t('gate.exit.markExit')}
        onConfirm={doExit}
      />
    </>
  )
}
