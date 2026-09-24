import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EllipsisVertical, MapPin, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { formatInTimeZone } from 'date-fns-tz'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { APP_TIMEZONE } from '@/config/app'
import { useMapContext } from '@/features/map/mapContext'
import { useErrorText } from '@/hooks/useErrorText'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { errorCode, errorDetail } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { queryKeys } from '@/lib/queryKeys'
import type { EventStatus, Language, LngLat } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { useAdminEvent } from '../layout/useAdminEvent'
import { closeEvent, setEventLive, upsertEvent, type EventListItem } from './api'
import { useMapData } from '@/features/map/useMapData'
import { BaseMap } from '@/features/map/BaseMap'
import { MapMarker } from '@/features/map/MapMarker'

const STATUS_TONE: Record<EventStatus, 'success' | 'neutral' | 'outline'> = { live: 'success', draft: 'outline', closed: 'neutral' }

function toLocalInput(iso: string): string {
  return formatInTimeZone(iso, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm")
}
function fromLocalInput(v: string): string {
  return new Date(`${v}:00+05:30`).toISOString()
}

/** Events `/admin/events` (docs/07 section 5.10, F-ADM-03). */
export function EventsPage() {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const wide = useMediaQuery('(min-width: 768px)')
  const { events, isLoading, error, refetch, selectEvent } = useAdminEvent()
  const [editing, setEditing] = useState<EventListItem | 'new' | null>(null)
  const [liveFor, setLiveFor] = useState<EventListItem | null>(null)
  const [closeFor, setCloseFor] = useState<EventListItem | null>(null)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.events() })
    void qc.invalidateQueries({ queryKey: queryKeys.liveEvent() })
  }

  const menu = (e: EventListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('admin.shared.rowActions')}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:size-9"
        >
          <EllipsisVertical size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setEditing(e)}>{t('admin.events.actions.edit')}</DropdownMenuItem>
        {e.status !== 'live' ? <DropdownMenuItem onSelect={() => setLiveFor(e)}>{t('admin.events.actions.setLive')}</DropdownMenuItem> : null}
        {e.status === 'live' ? (
          <DropdownMenuItem danger onSelect={() => setCloseFor(e)}>
            {t('admin.events.actions.close')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => {
            selectEvent(e.id)
            void navigate('/admin/map-editor')
          }}
        >
          {t('admin.events.actions.openEditor')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const dates = (e: EventListItem) => `${formatDateTime(e.starts_at)}  ${formatDateTime(e.ends_at)}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="md" className={ADMIN_BTN} icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={() => setEditing('new')}>
          {t('admin.events.add')}
        </Button>
      </div>
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading ? (
        <Skeleton className="h-60 w-full rounded-lg" />
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState title={t('admin.events.empty')} />
        </div>
      ) : wide ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.events.columns.name')}</TableHead>
                <TableHead>{t('admin.events.columns.dates')}</TableHead>
                <TableHead>{t('admin.events.columns.status')}</TableHead>
                <TableHead numeric>{t('admin.events.columns.zones')}</TableHead>
                <TableHead numeric>{t('admin.events.columns.slots')}</TableHead>
                <TableHead numeric>{t('admin.events.columns.vehicles')}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('admin.shared.rowActions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-semibold">{e.name}</TableCell>
                  <TableCell className="text-muted">
                    <span className="flex flex-col">
                      <span>{formatDateTime(e.starts_at)}</span>
                      <span>{formatDateTime(e.ends_at)}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[e.status]}>{t(`admin.eventStatus.${e.status}`)}</Badge>
                  </TableCell>
                  <TableCell numeric>{e.zones}</TableCell>
                  <TableCell numeric>{e.slots}</TableCell>
                  <TableCell numeric>{e.vehicles}</TableCell>
                  <TableCell className="w-12 text-right">{menu(e)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 py-3 pr-2 pl-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{e.name}</span>
                  <Badge tone={STATUS_TONE[e.status]}>{t(`admin.eventStatus.${e.status}`)}</Badge>
                </span>
                <span className="text-body-sm text-muted">{dates(e)}</span>
                <span className="flex gap-3 text-body-sm text-muted tabular-nums">
                  <span>
                    {t('admin.events.columns.zones')} {e.zones}
                  </span>
                  <span>
                    {t('admin.events.columns.slots')} {e.slots}
                  </span>
                  <span>
                    {t('admin.events.columns.vehicles')} {e.vehicles}
                  </span>
                </span>
              </div>
              {menu(e)}
            </li>
          ))}
        </ul>
      )}

      {editing ? <EventDialog event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}

      <ConfirmDialog
        open={Boolean(liveFor)}
        onOpenChange={(o) => !o && setLiveFor(null)}
        title={t('admin.events.setLiveDialog.title', { name: liveFor?.name ?? '' })}
        description={t('admin.events.setLiveDialog.body')}
        confirmLabel={t('admin.events.setLiveDialog.submit')}
        onConfirm={async () => {
          if (!liveFor) return
          try {
            await setEventLive(liveFor.id)
            toast.success(t('admin.events.liveToast'))
            refresh()
          } catch (err) {
            const other = errorDetail(err)
            toast.error(errorCode(err) === 'INVALID_STATE' && other ? t('admin.events.setLiveDialog.otherLive', { name: other }) : errorText(err))
            throw err
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(closeFor)}
        onOpenChange={(o) => !o && setCloseFor(null)}
        tone="danger"
        title={t('admin.events.closeDialog.title', { name: closeFor?.name ?? '' })}
        description={t('admin.events.closeDialog.body')}
        confirmLabel={t('admin.events.closeDialog.submit')}
        onConfirm={async () => {
          if (!closeFor) return
          try {
            await closeEvent(closeFor.id)
            toast.success(t('admin.events.closedToast'))
            refresh()
          } catch (err) {
            toast.error(errorText(err))
            throw err
          }
        }}
      />
    </div>
  )
}

function EventDialog({ event, onClose, onSaved }: { event: EventListItem | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const now = new Date()
  const [name, setName] = useState(event?.name ?? '')
  const [venue, setVenue] = useState(event?.venue_name ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.starts_at ?? now.toISOString()))
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.ends_at ?? new Date(now.getTime() + 8 * 3_600_000).toISOString()))
  const [language, setLanguage] = useState<Language>(event?.default_language ?? 'en')
  const [center, setCenter] = useState<LngLat>(event?.center ?? [76.6141, 8.8932])
  const [zoom, setZoom] = useState(String(event?.default_zoom ?? 17))
  const [picking, setPicking] = useState(false)
  const [tried, setTried] = useState(false)

  const nameErr = name.trim() ? null : t('admin.events.dialog.nameRequired')
  const dateErr = startsAt && endsAt && endsAt > startsAt ? null : t('admin.events.dialog.endAfterStart')

  const mutation = useMutation({
    mutationFn: () =>
      upsertEvent({
        id: event?.id ?? null,
        name: name.trim(),
        venue_name: venue.trim() || null,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
        default_language: language,
        center,
        default_zoom: Number(zoom) || 17,
      }),
    onSuccess: () => {
      toast.success(t('admin.events.savedToast'))
      onSaved()
      onClose()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? t('admin.events.dialog.editTitle') : t('admin.events.dialog.createTitle')}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (!nameErr && !dateErr) mutation.mutate()
          }}
        >
          <Field label={t('admin.events.dialog.name')} htmlFor="ev-name" error={tried ? nameErr : null}>
            <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} invalid={tried && Boolean(nameErr)} />
          </Field>
          <Field label={t('admin.events.dialog.venue')} htmlFor="ev-venue">
            <Input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.events.dialog.startsAt')} htmlFor="ev-start" helper={t('admin.events.dialog.timesHelper')}>
              <Input id="ev-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label={t('admin.events.dialog.endsAt')} htmlFor="ev-end" error={tried ? dateErr : null}>
              <Input id="ev-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} invalid={tried && Boolean(dateErr)} />
            </Field>
          </div>
          <Field label={t('admin.events.dialog.language')}>
            <SegmentedControl<Language>
              ariaLabel={t('admin.events.dialog.language')}
              value={language}
              onChange={setLanguage}
              options={[
                { value: 'en', label: t('common.languages.en') },
                { value: 'ml', label: t('common.languages.ml') },
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.events.dialog.center')}>
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-muted tabular-nums">
                  {center[1].toFixed(5)}, {center[0].toFixed(5)}
                </span>
                <Button variant="secondary" size="md" className={ADMIN_BTN} icon={<MapPin size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={() => setPicking((p) => !p)}>
                  {t('admin.events.dialog.pickOnMap')}
                </Button>
              </div>
            </Field>
            <Field label={t('admin.events.dialog.zoom')} htmlFor="ev-zoom">
              <Input id="ev-zoom" type="number" min={14} max={20} step={0.5} value={zoom} onChange={(e) => setZoom(e.target.value)} />
            </Field>
          </div>
          {picking && event ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-muted">{t('admin.events.dialog.pickHelp')}</p>
              <CenterPicker eventId={event.id} center={center} onPick={setCenter} />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={onClose}>
              {t('admin.shared.cancel')}
            </Button>
            <Button type="submit" size="md" className={ADMIN_BTN} loading={mutation.isPending}>
              {t('admin.events.dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Small map: click to set the event center. */
function CenterPicker({ eventId, center, onPick }: { eventId: string; center: LngLat; onPick: (c: LngLat) => void }) {
  const { eventMap } = useMapData(eventId, { withStatuses: false })
  if (!eventMap) return <Skeleton className="h-56 w-full rounded-lg" />
  return (
    <div className="h-56 overflow-hidden rounded-lg border border-line">
      <BaseMap eventMap={eventMap} baseLayer={eventMap.event.base_map} showZoneLabels={false}>
        <ClickToPick onPick={onPick} />
        <MapMarker lngLat={center} anchor="bottom">
          <MapPin size={28} strokeWidth={2} aria-hidden="true" className="fill-primary text-surface" />
        </MapMarker>
      </BaseMap>
    </div>
  )
}

function ClickToPick({ onPick }: { onPick: (c: LngLat) => void }) {
  const { map } = useMapContext()
  useEffect(() => {
    if (!map) return
    const h = (e: { lngLat: { lng: number; lat: number } }) => onPick([e.lngLat.lng, e.lngLat.lat])
    map.on('click', h)
    return () => {
      map.off('click', h)
    }
  }, [map, onPick])
  return null
}
