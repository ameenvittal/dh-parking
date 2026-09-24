import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Map as MlMap, PaddingOptions, StyleSpecification } from 'maplibre-gl'
import type { BaseMapKind, EventMapData, SlotStatus, VehicleType } from '@/types/domain'
import { STREET_STYLE_URL } from '@/config/app'
import { cn } from '@/lib/utils'
import { EventMapLayers } from './EventMapLayers'
import { MapContext, type MapContextValue, type MapLib } from './mapContext'
import {
  MAX_ZOOM_SATELLITE,
  MAX_ZOOM_STREET,
  MIN_ZOOM,
  bufferBbox,
  eventBbox,
  fallbackStyle,
  satelliteAvailable,
  satelliteStyle,
  type Bbox,
  type SlotPaintMode,
} from './style/layers'

export type FitTo = 'event' | 'zone' | 'route' | { bbox: Bbox }

export type BaseMapProps = {
  eventMap: EventMapData
  baseLayer: BaseMapKind
  /** default true */
  interactive?: boolean
  fitTo?: FitTo
  /** extra layers (RouteLayer, UserPuck, MapControls...) */
  children?: ReactNode
  onSlotClick?: (slotId: string) => void
  slotStatuses?: Map<string, SlotStatus>
  highlightSlotId?: string
  /** default all */
  visibleZoneIds?: string[]
  /** default false (editor and admin pass true) */
  showRoads?: boolean
  /** 'status' colours slots by status; 'neutral' (driver) greys all but the highlighted slot. Default: status when statuses are given. */
  slotPaint?: SlotPaintMode
  /** Only these vehicle types are clickable; other slots are dimmed (gate map picker). */
  activeVehicleTypes?: VehicleType[]
  /** Pulse the highlighted slot outline (driver screens only). */
  pulseHighlight?: boolean
  showZoneLabels?: boolean
  fitPadding?: number | PaddingOptions
  /** Fired once when the user drags or zooms the map by hand (turns off follow mode). */
  onUserMove?: () => void
  className?: string
  /** Accessible name for the map region. */
  ariaLabel?: string
  /** Where the (always visible) attribution sits; offset in px pushes it clear of floating bars. */
  attribution?: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; offset?: number }
}

let streetStylePromise: Promise<StyleSpecification | string> | null = null

/** Loads the street style JSON once. When it fails (offline, blocked) the plain fallback style is used. */
function loadStreetStyle(): Promise<StyleSpecification | string> {
  if (!streetStylePromise) {
    streetStylePromise = (async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 6000)
      try {
        const res = await fetch(STREET_STYLE_URL, { signal: ctrl.signal })
        if (!res.ok) throw new Error('style')
        const json: unknown = await res.json()
        if (!json || typeof json !== 'object' || !('layers' in json)) throw new Error('style')
        return json as StyleSpecification
      } catch {
        streetStylePromise = null
        return fallbackStyle()
      } finally {
        clearTimeout(timer)
      }
    })()
  }
  return streetStylePromise
}

async function resolveStyle(kind: BaseMapKind): Promise<StyleSpecification | string> {
  if (kind === 'satellite' && satelliteAvailable()) return satelliteStyle()
  return loadStreetStyle()
}

let libPromise: Promise<MapLib> | null = null
function loadLib(): Promise<MapLib> {
  if (!libPromise) libPromise = import('maplibre-gl')
  return libPromise
}

function effectiveKind(kind: BaseMapKind): BaseMapKind {
  return kind === 'satellite' && satelliteAvailable() ? 'satellite' : 'street'
}

function fitKey(fitTo: FitTo | undefined): string {
  if (!fitTo) return 'none'
  return typeof fitTo === 'string' ? fitTo : fitTo.bbox.map((n) => n.toFixed(6)).join(',')
}

/** Shared MapLibre map (docs/05 section 1). maplibre-gl is loaded lazily in its own chunk. */
export function BaseMap({
  eventMap,
  baseLayer,
  interactive = true,
  fitTo = 'event',
  children,
  onSlotClick,
  slotStatuses,
  highlightSlotId,
  visibleZoneIds,
  showRoads = false,
  slotPaint,
  activeVehicleTypes,
  pulseHighlight = false,
  showZoneLabels = true,
  fitPadding = 48,
  onUserMove,
  className,
  ariaLabel,
  attribution,
}: BaseMapProps) {
  const { t } = useTranslation('map')
  const containerRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<MapContextValue>({ map: null, lib: null, styleVersion: 0, zoom: 0 })
  const [failed, setFailed] = useState(false)
  const kind = effectiveKind(baseLayer)
  const kindRef = useRef(kind)
  const onUserMoveRef = useRef(onUserMove)
  const attributionRef = useRef(attribution)
  useEffect(() => {
    onUserMoveRef.current = onUserMove
  })

  const eventId = eventMap.event.id
  const extent = useMemo(() => eventBbox(eventMap), [eventMap])

  // Create the map once per event.
  useEffect(() => {
    let cancelled = false
    let created: MlMap | null = null
    const container = containerRef.current
    if (!container) return
    ;(async () => {
      try {
        const [lib, style] = await Promise.all([loadLib(), resolveStyle(kindRef.current)])
        if (cancelled) return
        const bounds = extent ? bufferBbox(extent, 500) : null
        const map = new lib.Map({
          container,
          style,
          center: eventMap.event.center,
          zoom: eventMap.event.default_zoom,
          minZoom: MIN_ZOOM,
          maxZoom: kindRef.current === 'satellite' ? MAX_ZOOM_SATELLITE : MAX_ZOOM_STREET,
          maxBounds: bounds ? [bounds[0], bounds[1], bounds[2], bounds[3]] : undefined,
          attributionControl: false,
          interactive,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          fadeDuration: 0,
        })
        map.touchZoomRotate.disableRotation()
        const pos = attributionRef.current?.position ?? 'bottom-right'
        map.addControl(new lib.AttributionControl({ compact: true }), pos)
        const offset = attributionRef.current?.offset
        const corner = container.querySelector<HTMLElement>(`.maplibregl-ctrl-${pos}`)
        if (corner && offset) corner.style[pos.startsWith('top') ? 'top' : 'bottom'] = `${offset}px`
        // Start collapsed to the (i) button; the attribution stays one tap away.
        map.once('idle', () => {
          container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
        })
        created = map
        map.on('style.load', () => {
          setCtx((c) => ({ ...c, map, lib, styleVersion: c.styleVersion + 1, zoom: map.getZoom() }))
        })
        map.on('zoomend', () => setCtx((c) => (Math.abs(c.zoom - map.getZoom()) < 0.01 ? c : { ...c, zoom: map.getZoom() })))
        const userMove = (e: { originalEvent?: unknown }) => {
          if (e.originalEvent) onUserMoveRef.current?.()
        }
        map.on('dragstart', userMove)
        map.on('zoomstart', userMove)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      created?.remove()
      setCtx({ map: null, lib: null, styleVersion: 0, zoom: 0 })
    }
    // The map is rebuilt only when the event changes; other props are applied live below.
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Base layer switch: setStyle, then layers are re-added on style.load.
  const { map } = ctx
  useEffect(() => {
    if (!map || kindRef.current === kind) return
    kindRef.current = kind
    let cancelled = false
    resolveStyle(kind).then((style) => {
      if (cancelled) return
      map.setMaxZoom(kind === 'satellite' ? MAX_ZOOM_SATELLITE : MAX_ZOOM_STREET)
      map.setStyle(style, { diff: false })
    })
    return () => {
      cancelled = true
    }
  }, [map, kind])

  // Camera fit.
  const key = fitKey(fitTo)
  const lastFit = useRef<string | null>(null)
  useEffect(() => {
    if (!map || ctx.styleVersion === 0 || lastFit.current === key) return
    const first = lastFit.current === null
    lastFit.current = key
    let box: Bbox | null = null
    if (typeof fitTo === 'object') box = fitTo.bbox
    else if (fitTo === 'zone' && visibleZoneIds?.length) box = eventBbox(eventMap, visibleZoneIds)
    else if (fitTo === 'event' || fitTo === 'zone') box = extent
    if (!box) return
    map.fitBounds(
      [
        [box[0], box[1]],
        [box[2], box[3]],
      ],
      { padding: fitPadding, maxZoom: 19, duration: first ? 0 : 400 },
    )
    // Refit only when the fit target changes, not on every data refresh.
  }, [map, ctx.styleVersion, key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the canvas sized to its container (sheets and panels change it).
  useEffect(() => {
    const el = containerRef.current
    if (!map || !el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  const mode: SlotPaintMode = slotPaint ?? (slotStatuses ? 'status' : 'neutral')

  return (
    <MapContext.Provider value={ctx}>
      <div className={cn('relative isolate h-full w-full overflow-hidden bg-surface-2', className)}>
        <div ref={containerRef} className="h-full w-full" role="region" aria-label={ariaLabel} />
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-body-sm text-muted">
            {t('map.loadFailed')}
          </p>
        ) : (
          <EventMapLayers
            eventMap={eventMap}
            mode={mode}
            slotStatuses={slotStatuses}
            highlightSlotId={highlightSlotId}
            visibleZoneIds={visibleZoneIds}
            showRoads={showRoads}
            activeVehicleTypes={activeVehicleTypes}
            pulseHighlight={pulseHighlight}
            showZoneLabels={showZoneLabels}
            onSlotClick={onSlotClick}
          />
        )}
        {children}
      </div>
    </MapContext.Provider>
  )
}
