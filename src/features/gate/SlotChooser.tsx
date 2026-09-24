import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SlotLabel } from '@/components/common/SlotLabel'
import { AccessibleIcon, EvChargerIcon } from '@/components/common/statusMeta'
import { formatMetres, localName } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'
import type { EventMapData, SlotSuggestion, VehicleType, VisitorCategory } from '@/types/domain'
import { suggestSlots } from './api'
import { SlotPickerSheet } from './SlotPickerSheet'
import type { CheckinSlot } from './store'

type SlotChooserProps = {
  eventId: string
  eventMap: EventMapData
  gateId: string
  vehicleType: VehicleType
  category: VisitorCategory
  needsAccessible: boolean
  selected: CheckinSlot | null
  onSelect: (slot: CheckinSlot | null) => void
  /** Bumped by the parent after SLOT_TAKEN to refetch. */
  refreshKey?: number
}

function toSlot(s: SlotSuggestion, lang: string): CheckinSlot {
  return { id: s.slot_id, label: s.label, zoneCode: s.zone_code, zoneName: localName({ name: s.zone_name, name_ml: s.zone_name_ml }, lang) }
}

/** Suggestions, zone chips and the map picker (docs/07 section 3.2, step 4). */
export function SlotChooser({
  eventId,
  eventMap,
  gateId,
  vehicleType,
  category,
  needsAccessible,
  selected,
  onSelect,
  refreshKey = 0,
}: SlotChooserProps) {
  const { t, i18n } = useTranslation('gate')
  const lang = i18n.language
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const params = { eventId, gateId, vehicleType, category, needsAccessible, limit: 5, zoneId, refreshKey }
  const query = useQuery({
    queryKey: queryKeys.suggestSlots(params),
    queryFn: () => suggestSlots({ eventId, gateId, vehicleType, category, needsAccessible, limit: 5, zoneId }),
    enabled: Boolean(gateId),
  })

  const suggestions = query.data?.suggestions ?? []
  const firstId = suggestions[0]?.slot_id
  const selectedId = selected?.id

  // Preselect the recommended slot; drop a selection that is no longer offered (unless picked on the map).
  const [pickedOnMap, setPickedOnMap] = useState(false)
  useEffect(() => {
    if (!query.data) return
    if (selectedId && (pickedOnMap || suggestions.some((s) => s.slot_id === selectedId))) return
    onSelect(suggestions[0] ? toSlot(suggestions[0], lang) : null)
    // run when the suggestion set changes
  }, [query.data, firstId]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoneColorOf = (zoneIdOf: string) => eventMap.zones.features.find((z) => z.id === zoneIdOf)?.properties.color ?? null
  const fallback = query.data?.fallback_used ?? 'none'
  const categoryLabel = t(`common.enums.category.${category}`)

  return (
    <div className="flex flex-col gap-4">
      {query.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : suggestions.length === 0 ? (
        <EmptyState title={t('gate.slot.noneFree')} className="py-4" />
      ) : (
        <div role="radiogroup" aria-label={t('gate.slot.recommended')} className="flex flex-col gap-2">
          <p className="text-caption text-muted">{t('gate.slot.recommended')}</p>
          {fallback !== 'none' ? (
            <Alert tone="info">
              {fallback === 'overflow'
                ? t('gate.slot.fallbackOverflow')
                : fallback === 'category_any'
                  ? t('gate.slot.fallbackCategory', { category: categoryLabel })
                  : t('gate.slot.fallbackAccessible')}
            </Alert>
          ) : null}
          {suggestions.map((s, i) => {
            const active = s.slot_id === selectedId
            const first = i === 0
            return (
              <div key={s.slot_id} className="contents">
                {i === 1 ? <p className="mt-2 text-caption text-muted">{t('gate.slot.otherFree')}</p> : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setPickedOnMap(false)
                    onSelect(toSlot(s, lang))
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
                    first ? 'p-4' : 'min-h-14 px-4 py-2',
                    active ? 'border-primary bg-primary-soft' : 'border-line bg-surface active:bg-canvas',
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {first ? (
                      <SlotLabel
                        size="md"
                        label={s.label}
                        zoneColor={zoneColorOf(s.zone_id)}
                        zoneName={localName({ name: s.zone_name, name_ml: s.zone_name_ml }, lang)}
                        accessible={s.is_accessible}
                        ev={s.has_ev_charger}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <SlotLabel size="sm" label={s.label} zoneColor={zoneColorOf(s.zone_id)} />
                        <span className="truncate text-body-sm text-muted">
                          {localName({ name: s.zone_name, name_ml: s.zone_name_ml }, lang)}
                        </span>
                        {s.is_accessible ? <AccessibleIcon size={16} strokeWidth={1.75} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                        {s.has_ev_charger ? <EvChargerIcon size={16} strokeWidth={1.75} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                      </div>
                    )}
                    <span className="text-body-sm text-muted tabular-nums">
                      {first ? t('gate.slot.fromGate', { distance: formatMetres(s.distance_m) }) : formatMetres(s.distance_m)}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      active ? 'border-primary' : 'border-line-strong',
                    )}
                  >
                    {active ? <span className="size-2.5 rounded-full bg-primary" /> : null}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selected && !suggestions.some((s) => s.slot_id === selected.id) ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary-soft p-4">
          <SlotLabel size="md" label={selected.label} zoneName={selected.zoneName} />
          <span className="text-caption text-primary">{t('gate.slot.fromMap')}</span>
        </div>
      ) : null}

      <Button
        variant="secondary"
        size="md"
        icon={<MapIcon size={20} strokeWidth={1.75} aria-hidden="true" />}
        onClick={() => setPickerOpen(true)}
        className="self-start"
      >
        {t('gate.slot.pickOnMap')}
      </Button>

      {query.data && query.data.zone_free_counts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-muted">{t('gate.slot.zones')}</p>
          <div className="flex flex-wrap gap-2">
            {query.data.zone_free_counts.map((z) => (
              <Chip
                key={z.zone_id}
                selected={zoneId === z.zone_id}
                onClick={() => setZoneId(zoneId === z.zone_id ? null : z.zone_id)}
                aria-label={t('gate.slot.zoneChipLabel', { code: z.code, count: z.free })}
              >
                <span className="font-bold">{z.code}</span>
                <span className="tabular-nums text-muted">{t('gate.slot.zoneFree', { count: z.free })}</span>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <SlotPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        eventId={eventId}
        vehicleType={vehicleType}
        onPick={(slot) => {
          setPickedOnMap(true)
          onSelect(slot)
        }}
      />
    </div>
  )
}
