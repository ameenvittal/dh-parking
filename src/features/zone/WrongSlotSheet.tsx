import { useMutation } from '@tanstack/react-query'
import { Check, List, Map as MapIcon, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { BaseMap } from '@/features/map/BaseMap'
import { MapControls } from '@/features/map/MapControls'
import { useMapContext } from '@/features/map/mapContext'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { formatPlate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BaseMapKind, EventMapData, VehicleType } from '@/types/domain'
import { confirmParked } from './api'
import { useZoneInvalidate } from './useZoneVisits'

type WrongSlotSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  /** Zones the volunteer may pick from (own zones). */
  zoneIds: string[]
  visit: { id: string; plate: string; vehicle_type: VehicleType; slot_id: string | null; slot_label: string | null } | null
  onDone?: () => void
}

/** car, ev and other are interchangeable for the correction; bike and bus are strict (docs/04 zone_confirm_parked). */
function typeGroup(t: VehicleType): string {
  return t === 'bike' || t === 'bus' ? t : 'car'
}

/** Smoothly centers the map on the selected slot when picked from map or search. */
function SlotFocuser({ slotId, eventMap }: { slotId: string | null; eventMap: EventMapData }) {
  const { map } = useMapContext()
  useEffect(() => {
    if (!map || !slotId) return
    const feat = eventMap.slots.features.find((f) => String(f.id) === slotId)
    if (!feat || !feat.geometry) return
    if (feat.geometry.type === 'Polygon') {
      const coords = feat.geometry.coordinates[0]
      if (!coords || !coords.length) return
      let sumLng = 0
      let sumLat = 0
      for (const [lng, lat] of coords) {
        sumLng += lng
        sumLat += lat
      }
      const centerLng = sumLng / coords.length
      const centerLat = sumLat / coords.length
      map.easeTo({ center: [centerLng, centerLat], zoom: Math.max(map.getZoom(), 17), duration: 300 })
    }
  }, [map, slotId, eventMap])
  return null
}

/** F-ZONE-04: pick the slot the vehicle is actually in, then confirm. */
export function WrongSlotSheet({ open, onOpenChange, eventId, zoneIds, visit, onDone }: WrongSlotSheetProps) {
  const { t } = useTranslation(['zone', 'common'])
  const errorText = useErrorText()
  const invalidate = useZoneInvalidate()
  const { eventMap, slotStatuses } = useMapData(open ? eventId : null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [base, setBase] = useState<BaseMapKind | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPicked(null)
      setQuery('')
    }
    onOpenChange(nextOpen)
  }

  const candidates = useMemo(() => {
    if (!eventMap || !slotStatuses || !visit) return []
    const zones = new Set(zoneIds)
    const group = typeGroup(visit.vehicle_type)
    return eventMap.slots.features
      .filter((f) => {
        const id = String(f.id)
        if (!zones.has(f.properties.zone_id)) return false
        if (typeGroup(f.properties.vehicle_type) !== group) return false
        return id === visit.slot_id || slotStatuses.get(id) === 'available'
      })
      .map((f) => ({ id: String(f.id), label: f.properties.label, zoneId: f.properties.zone_id }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
  }, [eventMap, slotStatuses, visit, zoneIds])

  const q = query.trim().toUpperCase().replace(/\s/g, '')
  const shown = q ? candidates.filter((c) => c.label.replace('-', '').includes(q.replace('-', ''))) : candidates
  const pickedSlot = candidates.find((c) => c.id === picked) ?? null
  const eligible = useMemo(() => new Set(candidates.map((c) => c.id)), [candidates])

  const mutation = useMutation({
    mutationFn: (slotId: string) => confirmParked({ visitId: visit?.id ?? '', actualSlotId: slotId }),
    onSuccess: (res) => {
      toast.success(t('zone.movedToast', { slot: res.slot_label }))
      invalidate(eventId, visit?.id)
      onOpenChange(false)
      setPicked(null)
      setQuery('')
      onDone?.()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-11/12 flex flex-col">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{t('zone.wrongSlotSheet.title')}</DrawerTitle>
          <DrawerDescription>
            {visit ? `${formatPlate(visit.plate)}  ` : null}
            {t('zone.wrongSlotSheet.body')}
          </DrawerDescription>
          <SegmentedControl<'map' | 'list'>
            ariaLabel={t('zone.view.label')}
            value={view}
            onChange={setView}
            size="sm"
            className="mt-2"
            options={[
              { value: 'map', label: t('zone.view.map'), icon: <MapIcon size={18} strokeWidth={1.75} aria-hidden="true" /> },
              { value: 'list', label: t('zone.view.list'), icon: <List size={18} strokeWidth={1.75} aria-hidden="true" /> },
            ]}
          />
        </DrawerHeader>
        <DrawerBody
          className={cn(
            'min-h-0 flex-1 px-4 pb-4',
            view === 'map' ? 'flex flex-col gap-2 overflow-hidden' : 'flex flex-col gap-3 overflow-y-auto',
          )}
        >
          <div className="relative shrink-0">
            <Search
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              value={query}
              onChange={(e) => {
                const val = e.target.value
                setQuery(val)
                const trimmed = val.trim().toUpperCase().replace(/\s/g, '')
                if (trimmed) {
                  const match = candidates.find((c) => c.label.replace('-', '').toUpperCase() === trimmed.replace('-', ''))
                  if (match) setPicked(match.id)
                }
              }}
              placeholder={t('zone.wrongSlotSheet.search')}
              aria-label={t('zone.wrongSlotSheet.search')}
              className="pl-10"
              autoCapitalize="characters"
              inputMode="text"
            />
          </div>

          {view === 'map' ? (
            <>
              {q && shown.length > 0 && shown.length <= 8 ? (
                <div className="flex shrink-0 flex-wrap gap-1.5 pt-0.5">
                  {shown.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPicked(c.id)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-display text-caption font-bold tabular-nums transition-colors',
                        c.id === picked ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      {c.id === picked ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : null}
                      {c.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div
                data-vaul-no-drag
                className="relative min-h-[300px] flex-1 overflow-hidden rounded-lg border border-line"
                style={{ touchAction: 'none' }}
              >
                {eventMap ? (
                  <BaseMap
                    eventMap={eventMap}
                    baseLayer={base ?? eventMap.event.base_map}
                    fitTo="zone"
                    visibleZoneIds={zoneIds}
                    slotStatuses={slotStatuses}
                    highlightSlotId={picked ?? visit?.slot_id ?? undefined}
                    onSlotClick={(id) => {
                      if (eligible.has(id)) {
                        setPicked(id)
                      } else {
                        const status = slotStatuses?.get(id)
                        if (status === 'assigned' || status === 'blocked') {
                          toast.error(t('zone.wrongSlotSheet.occupied'))
                        } else {
                          toast.error(t('zone.wrongSlotSheet.unavailable'))
                        }
                      }
                    }}
                    showZoneLabels={true}
                    ariaLabel={t('zone.zoneMap.loading')}
                  >
                    <MapControls
                      showZoom
                      baseLayer={base ?? eventMap.event.base_map}
                      onBaseLayerChange={setBase}
                    />
                    <SlotFocuser slotId={picked} eventMap={eventMap} />
                    {pickedSlot ? (
                      <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-80px)]">
                        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface/95 px-3 py-1.5 shadow-raised backdrop-blur-xs">
                          <span className="font-display text-body font-bold text-ink">{pickedSlot.label}</span>
                          <span className="font-semibold text-caption text-primary">{t('zone.wrongSlotSheet.selected')}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pointer-events-none absolute top-3 left-3 z-10">
                        <div className="rounded-md border border-line bg-surface/90 px-2.5 py-1 text-caption font-medium text-muted shadow-raised backdrop-blur-xs">
                          {t('zone.wrongSlotSheet.tapSlotPrompt')}
                        </div>
                      </div>
                    )}
                  </BaseMap>
                ) : null}
              </div>
            </>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-body text-muted">{t('zone.wrongSlotSheet.empty')}</p>
          ) : (
            <ul role="listbox" aria-label={t('zone.wrongSlotSheet.pick')} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((c) => {
                const selected = c.id === picked
                const current = c.id === visit?.slot_id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setPicked(c.id)}
                      className={cn(
                        'flex h-14 w-full flex-col items-center justify-center rounded-md border font-display text-h3 font-bold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
                        selected ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-surface text-ink',
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {selected ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : null}
                        {c.label}
                      </span>
                      {current ? (
                        <span className="font-sans text-caption font-semibold text-muted">{t('zone.wrongSlotSheet.assignedNow')}</span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </DrawerBody>
        <DrawerFooter>
          <Button
            size="lg"
            block
            disabled={!pickedSlot}
            loading={mutation.isPending}
            onClick={() => pickedSlot && mutation.mutate(pickedSlot.id)}
          >
            {pickedSlot ? t('zone.wrongSlotSheet.confirmIn', { slot: pickedSlot.label }) : t('zone.wrongSlotSheet.pick')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

