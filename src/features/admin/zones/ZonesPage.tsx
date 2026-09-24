import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Accessibility, PlugZap, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PlateChip } from '@/components/common/PlateChip'
import { StatusBadge } from '@/components/common/StatusBadge'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useErrorText } from '@/hooks/useErrorText'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { EventListItem, SlotWithVisit, ZoneWithCounts } from '@/lib/demo/types'
import { formatRelative, localName } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import { cn } from '@/lib/utils'
import { VEHICLE_TYPES, type VehicleType } from '@/types/domain'
import { useNow } from '@/features/zone/useNow'
import { ADMIN_BTN } from '../components/buttonSizes'
import { RequireEvent } from '../components/RequireEvent'
import { ZoneDot } from '../components/ZoneDot'
import { getZonesSlots, setSlotsProps, setSlotsStatus, type SetSlotsStatusResult } from './api'

/** Zones and slots `/admin/zones` (docs/07 section 5.6, F-MAP-10). */
export function ZonesPage() {
  return <RequireEvent>{(event) => <ZonesView event={event} />}</RequireEvent>
}

function ZonesView({ event }: { event: EventListItem }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = useQuery({ queryKey: queryKeys.zonesSlots(event.id), queryFn: () => getZonesSlots(event.id) })
  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: queryKeys.zonesSlots(event.id) }), [qc, event.id])
  useRealtime(['slots', 'map', 'visits'], onChange)

  const zones = query.data?.zones ?? []
  const zoneId = params.get('zone') ?? zones[0]?.id ?? null
  const zone = zones.find((z) => z.id === zoneId) ?? null

  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-lg" />
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (zones.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        <EmptyState
          title={t('admin.zones.noZones')}
          description={t('admin.zones.noZonesBody')}
          action={
            <Button asChild variant="secondary" size="md">
              <Link to="/admin/map-editor">{t('admin.zones.openInEditor')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="flex shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-surface lg:w-80">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-h3 text-ink">{t('admin.zones.zonesList')}</h2>
          <Link to="/admin/map-editor" className="text-body-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t('admin.zones.openInEditor')}
          </Link>
        </div>
        <ul className="no-scrollbar flex overflow-x-auto lg:flex-col lg:divide-y lg:divide-line lg:overflow-visible">
          {zones.map((z) => (
            <li key={z.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                aria-current={z.id === zoneId ? 'true' : undefined}
                onClick={() => setParams({ zone: z.id }, { replace: true })}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
                  z.id === zoneId ? 'bg-primary-soft' : 'hover:bg-canvas',
                )}
              >
                <ZoneDot color={z.color} className="h-8" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{z.code}</span>
                    <span className="truncate text-body-sm text-muted">{localName(z, i18n.language)}</span>
                  </span>
                  <span className="text-caption text-muted tabular-nums">{t('admin.zones.freeOfTotal', { free: z.available, total: z.total })}</span>
                </span>
                <TypeIcons types={z.vehicle_types} />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {zone ? <ZoneDetail zone={zone} slots={(query.data?.slots ?? []).filter((s) => s.zone_id === zone.id)} onChanged={onChange} /> : (
        <EmptyState title={t('admin.zones.pickZone')} />
      )}
    </div>
  )
}

function TypeIcons({ types }: { types: VehicleType[] }) {
  const { t } = useTranslation('common')
  return (
    <span className="inline-flex shrink-0 gap-1">
      {types.map((ty) => {
        const Icon = vehicleTypeIcon[ty]
        return <Icon key={ty} size={16} strokeWidth={1.75} className="text-muted" aria-label={t(`enums.vehicleType.${ty}`)} role="img" />
      })}
    </span>
  )
}

function ZoneDetail({ zone, slots, onChanged }: { zone: ZoneWithCounts; slots: SlotWithVisit[]; onChanged: () => void }) {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const wide = useMediaQuery('(min-width: 768px)')
  const now = useNow()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [blockOpen, setBlockOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [typeOpen, setTypeOpen] = useState(false)
  const [newType, setNewType] = useState<VehicleType>('car')

  const q = search.trim().toUpperCase()
  const rows = useMemo(
    () => slots.filter((s) => !q || s.label.includes(q)).sort((a, b) => a.number - b.number),
    [slots, q],
  )
  const ids = [...selected].filter((id) => slots.some((s) => s.id === id))
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id))

  const report = (res: SetSlotsStatusResult | { updated: number }) => {
    toast.success(t('admin.zones.updated', { count: res.updated }))
    if ('skipped' in res && res.skipped.length) toast(t('admin.zones.skipped', { labels: res.skipped.join(', ') }))
    setSelected(new Set())
    onChanged()
  }
  const status = useMutation({
    mutationFn: (v: { to: 'available' | 'blocked'; reason: string | null }) => setSlotsStatus(ids, v.to, v.reason),
    onSuccess: report,
    onError: (err) => toast.error(errorText(err)),
  })
  const props = useMutation({
    mutationFn: (patch: { vehicle_type?: VehicleType; is_accessible?: boolean }) => setSlotsProps(ids, patch),
    onSuccess: report,
    onError: (err) => toast.error(errorText(err)),
  })

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-h2 text-ink">
            <ZoneDot color={zone.color} className="h-6" />
            {zone.code} {localName(zone, i18n.language)}
          </h2>
          <Button asChild variant="secondary" size="md" className={ADMIN_BTN}>
            <Link to="/admin/map-editor">{t('admin.zones.editInEditor')}</Link>
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-body-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">{t('admin.zones.rules.types')}</dt>
            <dd className="text-ink">{zone.vehicle_types.map((ty) => t(`common.enums.vehicleType.${ty}`)).join(', ')}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('admin.zones.rules.categories')}</dt>
            <dd className="text-ink">
              {zone.categories.length ? zone.categories.map((c) => t(`common.enums.category.${c}`)).join(', ') : t('admin.zones.rules.allCategories')}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{t('admin.zones.rules.overflow')}</dt>
            <dd className="text-ink">{zone.is_overflow ? t('admin.shared.yes') : t('admin.shared.no')}</dd>
          </div>
          <div>
            <dt className="text-muted">{t('admin.zones.rules.priority')}</dt>
            <dd className="text-ink tabular-nums">{zone.priority}</dd>
          </div>
        </dl>
      </div>

      <div className="relative">
        <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.zones.searchSlot')} aria-label={t('admin.zones.searchSlot')} className="pl-9 sm:max-w-72" />
      </div>

      {ids.length > 0 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-primary bg-primary-soft p-2 pl-4">
          <span className="mr-2 text-body-sm font-semibold text-primary">{t('admin.shared.selectedCount', { count: ids.length })}</span>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => setBlockOpen(true)}>
            {t('admin.zones.bulk.block')}
          </Button>
          <Button variant="secondary" size="md" className={ADMIN_BTN} loading={status.isPending} onClick={() => status.mutate({ to: 'available', reason: null })}>
            {t('admin.zones.bulk.unblock')}
          </Button>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => setTypeOpen(true)}>
            {t('admin.zones.bulk.setType')}
          </Button>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => props.mutate({ is_accessible: true })}>
            {t('admin.zones.bulk.markAccessible')}
          </Button>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => props.mutate({ is_accessible: false })}>
            {t('admin.zones.bulk.unmarkAccessible')}
          </Button>
          <Button variant="ghost" size="md" className={ADMIN_BTN} onClick={() => setSelected(new Set())}>
            {t('admin.zones.bulk.clear')}
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState title={t('admin.zones.noSlots')} />
        </div>
      ) : wide ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table wrapperClassName="max-h-160">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={t('admin.zones.selectAll')}
                    checked={allChecked}
                    onCheckedChange={(c) => setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </TableHead>
                {(['label', 'type', 'accessible', 'ev', 'status', 'vehicle', 'since'] as const).map((c) => (
                  <TableHead key={c}>{t(`admin.zones.columns.${c}`)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} selected={selected.has(s.id)}>
                  <TableCell>
                    <Checkbox aria-label={t('admin.zones.selectSlot', { label: s.label })} checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  </TableCell>
                  <TableCell className="font-display font-bold tabular-nums">{s.label}</TableCell>
                  <TableCell>{t(`common.enums.vehicleType.${s.vehicle_type}`)}</TableCell>
                  <TableCell>{s.is_accessible ? <Accessibility size={16} strokeWidth={1.75} className="text-primary" aria-label={t('common.accessible')} role="img" /> : null}</TableCell>
                  <TableCell>{s.has_ev_charger ? <PlugZap size={16} strokeWidth={1.75} className="text-primary" aria-label={t('common.evCharger')} role="img" /> : null}</TableCell>
                  <TableCell>
                    <span className="flex flex-col gap-0.5">
                      <StatusBadge status={s.status} vehicleType={s.vehicle_type} />
                      {s.blocked_reason ? <span className="text-caption text-muted">{s.blocked_reason}</span> : null}
                    </span>
                  </TableCell>
                  <TableCell>{s.plate ? <PlateChip plate={s.plate} size="sm" /> : null}</TableCell>
                  <TableCell className="text-muted">{formatRelative(s.status_changed_at, t, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((s) => (
            <li key={s.id}>
              <label className={cn('flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2', selected.has(s.id) && 'bg-primary-soft')}>
                <Checkbox aria-label={t('admin.zones.selectSlot', { label: s.label })} checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="w-16 font-display text-h3 font-bold tabular-nums">{s.label}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <StatusBadge status={s.status} vehicleType={s.vehicle_type} />
                  {s.plate ? <PlateChip plate={s.plate} size="sm" /> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={(o) => {
          setBlockOpen(o)
          if (!o) setReason('')
        }}
        title={t('admin.zones.blockDialog.title', { count: ids.length })}
        confirmLabel={t('admin.zones.blockDialog.submit')}
        confirmDisabled={!reason.trim()}
        onConfirm={() => status.mutateAsync({ to: 'blocked', reason: reason.trim() })}
      >
        <Field label={t('admin.zones.blockDialog.reason')} htmlFor="block-reason">
          <Input id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        title={t('admin.zones.typeDialog.title')}
        confirmLabel={t('admin.zones.typeDialog.submit')}
        onConfirm={() => props.mutateAsync({ vehicle_type: newType })}
      >
        <Select
          aria-label={t('admin.zones.columns.type')}
          value={newType}
          onChange={(e) => setNewType(e.target.value as VehicleType)}
          options={VEHICLE_TYPES.map((ty) => ({ value: ty, label: t(`common.enums.vehicleType.${ty}`) }))}
        />
      </ConfirmDialog>
    </section>
  )
}
