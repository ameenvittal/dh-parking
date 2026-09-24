import { useMutation } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { useMapData } from '@/features/map/useMapData'
import { useErrorText } from '@/hooks/useErrorText'
import { formatPlate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VehicleType } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { useAdminRefresh } from '../components/useAdminRefresh'
import { reassignVisit } from './api'

type ChangeSlotDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  visit: { id: string; plate: string; vehicle_type: VehicleType; slot_id: string | null }
}

/** Reassign through visit-reassign. Only free slots of the same vehicle type (`other` may use car slots). */
export function ChangeSlotDialog({ open, onOpenChange, eventId, visit }: ChangeSlotDialogProps) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const refresh = useAdminRefresh()
  const { eventMap, slotStatuses, isLoading } = useMapData(open ? eventId : null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [notify, setNotify] = useState(true)

  const options = useMemo(() => {
    if (!eventMap || !slotStatuses) return []
    const zoneCode = new Map(eventMap.zones.features.map((z) => [String(z.id), z.properties.code]))
    return eventMap.slots.features
      .filter((f) => {
        const ty = f.properties.vehicle_type
        const typeOk = ty === visit.vehicle_type || (visit.vehicle_type === 'other' && ty === 'car')
        return typeOk && String(f.id) !== visit.slot_id && slotStatuses.get(String(f.id)) === 'available'
      })
      .map((f) => ({ id: String(f.id), label: f.properties.label, zone: zoneCode.get(f.properties.zone_id) ?? '' }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
  }, [eventMap, slotStatuses, visit])

  const q = query.trim().toUpperCase().replace(/[\s-]/g, '')
  const shown = q ? options.filter((o) => o.label.replace('-', '').includes(q)) : options
  const pickedOption = options.find((o) => o.id === picked) ?? null

  const mutation = useMutation({
    mutationFn: () => reassignVisit({ visitId: visit.id, newSlotId: picked ?? '', notify }),
    onSuccess: (res) => {
      toast.success(t('admin.vehicles.changeSlot.done', { slot: res.slot.label }))
      refresh()
      onOpenChange(false)
      setPicked(null)
      setQuery('')
    },
    onError: (err) => toast.error(errorText(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('admin.vehicles.changeSlot.title')}</DialogTitle>
          <DialogDescription>{t('admin.vehicles.changeSlot.body', { plate: formatPlate(visit.plate) })}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.vehicles.changeSlot.search')}
            aria-label={t('admin.vehicles.changeSlot.search')}
            className="pl-9"
          />
        </div>
        <div className="max-h-64 min-h-24 overflow-y-auto">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted">{t('admin.vehicles.changeSlot.empty')}</p>
          ) : (
            <ul role="listbox" aria-label={t('admin.vehicles.changeSlot.pick')} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shown.map((o) => {
                const selected = o.id === picked
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => setPicked(o.id)}
                      className={cn(
                        'flex h-11 w-full items-center justify-center gap-1 rounded-md border font-display text-body font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-focus lg:h-10',
                        selected ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
                      )}
                    >
                      {selected ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : null}
                      {o.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <SwitchRow label={t('admin.vehicles.changeSlot.notify')} checked={notify} onCheckedChange={setNotify} />
        <DialogFooter>
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => onOpenChange(false)}>
            {t('admin.shared.cancel')}
          </Button>
          <Button size="md" className={ADMIN_BTN} disabled={!pickedOption} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {pickedOption ? t('admin.vehicles.changeSlot.submit', { slot: pickedOption.label }) : t('admin.vehicles.changeSlot.pick')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
