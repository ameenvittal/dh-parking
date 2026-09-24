import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useMapData } from '@/features/map/useMapData'
import { useNow } from '@/features/zone/useNow'
import type { EventListItem } from '@/lib/demo/types'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { ALERT_TYPES, type AlertStatus, type AlertType } from '@/types/domain'
import { RequireEvent } from '../components/RequireEvent'
import { VisitDrawer } from '../visits/VisitDrawer'
import { AlertDrawer } from './AlertDrawer'
import { AlertRow } from './AlertRow'
import { listAlerts } from './api'

const HIGHLIGHT_MS = 2_000

/** Alerts `/admin/alerts` (docs/07 section 5.4, F-ADM-05). */
export function AlertsPage() {
  return <RequireEvent>{(event) => <AlertsView event={event} />}</RequireEvent>
}

function AlertsView({ event }: { event: EventListItem }) {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const now = useNow()
  const [status, setStatus] = useState<AlertStatus>('open')
  const [type, setType] = useState<AlertType | ''>('')
  const [zone, setZone] = useState('')
  const [alertId, setAlertId] = useState<string | null>(null)
  const [visitId, setVisitId] = useState<string | null>(null)
  const { eventMap } = useMapData(event.id, { withStatuses: false })

  const filters = { eventId: event.id, status, types: type ? [type] : undefined, zoneIds: zone ? [zone] : undefined }
  const query = useQuery({ queryKey: queryKeys.alertList(event.id, filters), queryFn: () => listAlerts(filters) })
  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: queryKeys.alerts(event.id) }), [qc, event.id])
  useRealtime(['alerts'], onChange)

  // New rows arriving by realtime get a 2 s highlight.
  const seen = useRef<Set<string> | null>(null)
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  useEffect(() => {
    seen.current = null
  }, [status, type, zone])
  useEffect(() => {
    if (!query.data) return
    const ids = query.data.map((a) => a.id)
    if (seen.current) {
      const prev = seen.current
      const fresh = ids.filter((id) => !prev.has(id))
      if (fresh.length) {
        setHighlight((h) => new Set([...h, ...fresh]))
        setTimeout(() => setHighlight((h) => new Set([...h].filter((x) => !fresh.includes(x)))), HIGHLIGHT_MS)
      }
    }
    seen.current = new Set(ids)
  }, [query.data])

  const zones = eventMap?.zones.features ?? []
  const alerts = query.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(v as AlertStatus)} className="min-w-0">
          <TabsList className="lg:w-auto lg:border-b-0">
            {(['open', 'acknowledged', 'resolved'] as const).map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`admin.alerts.tabs.${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:w-auto">
          <Select
            aria-label={t('admin.alerts.filterType')}
            value={type}
            onChange={(e) => setType(e.target.value as AlertType | '')}
            className="lg:w-48"
            options={[{ value: '', label: t('admin.alerts.allTypes') }, ...ALERT_TYPES.map((a) => ({ value: a, label: t(`admin.alertType.${a}`) }))]}
          />
          <Select
            aria-label={t('admin.alerts.filterZone')}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="lg:w-48"
            options={[
              { value: '', label: t('admin.alerts.allZones') },
              ...zones.map((z) => ({ value: String(z.id), label: `${z.properties.code} ${z.properties.name}` })),
            ]}
          />
        </div>
      </div>

      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {query.isLoading ? (
          <div className="flex flex-col gap-px">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-none" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState title={t(`admin.alerts.empty.${status}`)} />
        ) : (
          <ul className="divide-y divide-line">
            {alerts.map((a) => (
              <AlertRow key={a.id} alert={a} now={now} highlight={highlight.has(a.id)} onClick={() => setAlertId(a.id)} />
            ))}
          </ul>
        )}
      </div>

      <AlertDrawer
        alertId={alertId}
        onOpenChange={(o) => !o && setAlertId(null)}
        onOpenVehicle={(id) => {
          setAlertId(null)
          setVisitId(id)
        }}
      />
      <VisitDrawer visitId={visitId} onOpenChange={(o) => !o && setVisitId(null)} />
    </div>
  )
}
