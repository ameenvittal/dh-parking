import { useMutation } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Input } from '@/components/ui/Input'
import { BaseMap } from '@/features/map/BaseMap'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { formatPlate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VehicleType } from '@/types/domain'
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

/** F-ZONE-04: pick the slot the vehicle is actually in, then confirm. */
export function WrongSlotSheet({ open, onOpenChange, eventId, zoneIds, visit, onDone }: WrongSlotSheetProps) {
  const { t } = useTranslation(['zone', 'common'])
  const errorText = useErrorText()
  const invalidate = useZoneInvalidate()
  const { eventMap, slotStatuses } = useMapData(open ? eventId : null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-11/12">
        <DrawerHeader>
          <DrawerTitle>{t('zone.wrongSlotSheet.title')}</DrawerTitle>
          <DrawerDescription>
            {visit ? `${formatPlate(visit.plate)}  ` : null}
            {t('zone.wrongSlotSheet.body')}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-3">
          <div className="h-48 shrink-0 overflow-hidden rounded-lg border border-line">
            {eventMap ? (
              <BaseMap
                eventMap={eventMap}
                baseLayer={eventMap.event.base_map}
                fitTo="zone"
                visibleZoneIds={zoneIds}
                slotStatuses={slotStatuses}
                highlightSlotId={picked ?? visit?.slot_id ?? undefined}
                onSlotClick={(id) => {
                  if (eligible.has(id)) setPicked(id)
                }}
                showZoneLabels={false}
                ariaLabel={t('zone.map.loading')}
              />
            ) : null}
          </div>
          <div className="relative">
            <Search
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('zone.wrongSlotSheet.search')}
              aria-label={t('zone.wrongSlotSheet.search')}
              className="pl-10"
              autoCapitalize="characters"
              inputMode="text"
            />
          </div>
          {shown.length === 0 ? (
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
