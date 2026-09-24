import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { MapLayerMouseEvent } from 'maplibre-gl'
import { CircleHelp, DoorOpen } from 'lucide-react'
import type { EventMapData, SlotStatus, VehicleType } from '@/types/domain'
import { localName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MapMarker } from './MapMarker'
import { useMapContext } from './mapContext'
import { LANDMARK_ICONS } from './style/icons'
import {
  addEventLayers,
  addEventSources,
  applySlotStatuses,
  updateEventLayers,
  zoneLabelPoint,
  type EventLayerOptions,
  type SlotPaintMode,
} from './style/layers'


type EventMapLayersProps = {
  eventMap: EventMapData
  mode: SlotPaintMode
  slotStatuses?: Map<string, SlotStatus>
  highlightSlotId?: string
  visibleZoneIds?: string[]
  showRoads: boolean
  activeVehicleTypes?: VehicleType[]
  pulseHighlight: boolean
  showZoneLabels: boolean
  onSlotClick?: (slotId: string) => void
}

const LANDMARK_NAME_ZOOM = 17
const PULSE_MS = 1600

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Zones, roads, slots (feature-state colours), gates, landmarks and zone labels. Rendered by BaseMap. */
export function EventMapLayers({
  eventMap,
  mode,
  slotStatuses,
  highlightSlotId,
  visibleZoneIds,
  showRoads,
  activeVehicleTypes,
  pulseHighlight,
  showZoneLabels,
  onSlotClick,
}: EventMapLayersProps) {
  const { t, i18n } = useTranslation('map')
  const { map, styleVersion, zoom } = useMapContext()
  const prevStatuses = useRef<Map<string, SlotStatus> | null>(null)

  const zoneKey = visibleZoneIds?.join(',') ?? ''
  const typeKey = activeVehicleTypes?.join(',') ?? ''
  const options: EventLayerOptions = useMemo(
    () => ({
      mode,
      highlightSlotId: highlightSlotId ?? null,
      visibleZoneIds: visibleZoneIds ?? null,
      showRoads,
      activeVehicleTypes: activeVehicleTypes ?? null,
    }),
    // arrays compared by content
    [mode, highlightSlotId, zoneKey, showRoads, typeKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const optionsRef = useRef(options)
  const statusesRef = useRef(slotStatuses)
  useEffect(() => {
    optionsRef.current = options
    statusesRef.current = slotStatuses
  })

  // Sources and layers: added on every style load and whenever the map data changes.
  useEffect(() => {
    if (!map || styleVersion === 0) return
    addEventSources(map, eventMap)
    addEventLayers(map, optionsRef.current)
    updateEventLayers(map, optionsRef.current)
    if (statusesRef.current) {
      applySlotStatuses(map, statusesRef.current, null)
      prevStatuses.current = statusesRef.current
    }
  }, [map, styleVersion, eventMap])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    updateEventLayers(map, options)
  }, [map, styleVersion, options])

  useEffect(() => {
    if (!map || styleVersion === 0 || !slotStatuses) return
    applySlotStatuses(map, slotStatuses, prevStatuses.current)
    prevStatuses.current = slotStatuses
  }, [map, styleVersion, slotStatuses])

  // Highlight pulse: the only motion on the map (docs 06 section 7).
  useEffect(() => {
    if (!map || styleVersion === 0 || !highlightSlotId || !pulseHighlight || prefersReducedMotion()) return
    let raf = 0
    const started = performance.now()
    const tick = (now: number) => {
      const phase = ((now - started) % PULSE_MS) / PULSE_MS
      const opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2))
      if (map.getLayer('slots-highlight')) map.setPaintProperty('slots-highlight', 'line-opacity', opacity)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      if (map.getLayer('slots-highlight')) map.setPaintProperty('slots-highlight', 'line-opacity', 1)
    }
  }, [map, styleVersion, highlightSlotId, pulseHighlight])

  // Slot clicks.
  const onSlotClickRef = useRef(onSlotClick)
  useEffect(() => {
    onSlotClickRef.current = onSlotClick
  })
  const clickable = Boolean(onSlotClick)
  useEffect(() => {
    if (!map || styleVersion === 0 || !clickable) return
    const isActive = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f) return null
      const types = optionsRef.current.activeVehicleTypes
      const type = f.properties?.vehicle_type
      if (types && !types.includes(type)) return null
      const id = f.properties?.id
      return typeof id === 'string' ? id : null
    }
    const onClick = (e: MapLayerMouseEvent) => {
      const id = isActive(e)
      if (id) onSlotClickRef.current?.(id)
    }
    const onMove = (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = isActive(e) ? 'pointer' : ''
    }
    const onLeave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', 'slots-fill', onClick)
    map.on('mousemove', 'slots-fill', onMove)
    map.on('mouseleave', 'slots-fill', onLeave)
    return () => {
      map.off('click', 'slots-fill', onClick)
      map.off('mousemove', 'slots-fill', onMove)
      map.off('mouseleave', 'slots-fill', onLeave)
    }
  }, [map, styleVersion, clickable])

  const lang = i18n.language
  const freeByZone = useMemo(() => {
    if (!slotStatuses) return null
    const zoneOf = new Map<string, string>()
    for (const s of eventMap.slots.features) if (s.id) zoneOf.set(s.id, s.properties.zone_id)
    const counts = new Map<string, number>()
    for (const [id, status] of slotStatuses) {
      if (status !== 'available') continue
      const z = zoneOf.get(id)
      if (z) counts.set(z, (counts.get(z) ?? 0) + 1)
    }
    return counts
  }, [eventMap, slotStatuses])

  const zoneLabels = useMemo(
    () =>
      eventMap.zones.features
        .filter((z) => z.id && (!visibleZoneIds || visibleZoneIds.includes(z.id)))
        .map((z) => ({ id: z.id as string, point: zoneLabelPoint(z.geometry), props: z.properties })),
    // arrays compared by content
    [eventMap, zoneKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!map) return null
  const showLandmarkNames = zoom >= LANDMARK_NAME_ZOOM

  return (
    <>
      {showZoneLabels
        ? zoneLabels.map((z) => (
            <MapMarker key={`zone-${z.id}`} lngLat={z.point} className="pointer-events-none">
              <div className="flex flex-col items-center rounded-sm bg-surface/90 px-2 py-0.5 text-center shadow-raised">
                <span className="max-w-40 truncate text-body-sm font-semibold text-ink">{localName(z.props, lang)}</span>
                {freeByZone ? (
                  <span className="text-caption text-muted tabular-nums">
                    {t('map.zoneFree', { count: freeByZone.get(z.id) ?? 0 })}
                  </span>
                ) : null}
              </div>
            </MapMarker>
          ))
        : null}
      {eventMap.gates.features.map((g) => (
        <MapMarker
          key={`gate-${g.id}`}
          lngLat={[g.geometry.coordinates[0], g.geometry.coordinates[1]]}
          className="pointer-events-none"
        >
          <div className="flex flex-col items-center gap-0.5">
            <span
              role="img"
              aria-label={localName(g.properties, lang)}
              className="flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-raised"
            >
              <DoorOpen size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
            {showLandmarkNames ? (
              <span className="rounded-xs bg-surface/90 px-1 text-caption text-ink">{localName(g.properties, lang)}</span>
            ) : null}
          </div>
        </MapMarker>
      ))}
      {eventMap.landmarks.features.map((l) => {
        const Icon = LANDMARK_ICONS[l.properties.kind] ?? CircleHelp
        return (
          <MapMarker
            key={`landmark-${l.id}`}
            lngLat={[l.geometry.coordinates[0], l.geometry.coordinates[1]]}
            className="pointer-events-none"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span
                role="img"
                aria-label={localName(l.properties, lang)}
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border border-line bg-surface shadow-raised',
                  l.properties.kind === 'first_aid' ? 'text-danger' : 'text-ink',
                )}
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
              </span>
              {showLandmarkNames ? (
                <span className="max-w-32 truncate rounded-xs bg-surface/90 px-1 text-caption text-ink">
                  {localName(l.properties, lang)}
                </span>
              ) : null}
            </div>
          </MapMarker>
        )
      })}
    </>
  )
}
