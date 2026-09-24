/**
 * Map sources, layers and the fixed layer order from docs/05-MAPS-AND-NAVIGATION.md section 2.
 * Every map screen builds its data layers from here so styling stays in one place.
 */
import type {
  AddLayerObject,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as MlMap,
  StyleSpecification,
} from 'maplibre-gl'
import { bbox as turfBbox, centroid, featureCollection, pointOnFeature, polygon as turfPolygon } from '@turf/turf'
import type { EventMapData, LngLat, SlotStatus, VehicleType } from '@/types/domain'
import { MAPTILER_KEY } from '@/config/app'
import { mapColors, slotStatusColors, zoneColor } from './colors'

export const SOURCE = {
  zones: 'zones',
  roads: 'roads',
  slots: 'slots',
  slotPoints: 'slot-points',
  route: 'route',
  routeLegs: 'route-legs',
  vehicles: 'vehicles',
} as const

/** Bottom to top. Layers added through `addLayerOrdered` always land in this order. */
export const LAYER_ORDER = [
  'overlay-image',
  'zones-fill',
  'zones-line',
  'roads-casing',
  'roads-line',
  'roads-oneway-arrows',
  'slots-fill',
  'slots-hatch',
  'slots-line',
  'slots-highlight',
  'slots-label',
  'slots-icons',
  'route-casing',
  'route-line',
  'route-leg',
  'vehicles',
  'gates',
  'landmarks',
  'zones-label',
] as const
export type LayerId = (typeof LAYER_ORDER)[number]

export const IMAGE = {
  hatch: 'hatch',
  arrow: 'arrow-oneway',
  accessible: 'icon-accessible',
  ev: 'icon-ev',
} as const

export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
export const MAP_FONT = ['Noto Sans Regular']
export const MAP_FONT_BOLD = ['Noto Sans Bold']
export const MIN_ZOOM = 14
export const MAX_ZOOM_STREET = 20
export const MAX_ZOOM_SATELLITE = 21
export const SLOT_DETAIL_ZOOM = 18.5

/** Adds a layer below the next layer (in LAYER_ORDER) that already exists on the map. */
export function addLayerOrdered(map: MlMap, layer: AddLayerObject & { id: LayerId }) {
  if (map.getLayer(layer.id)) return
  const idx = LAYER_ORDER.indexOf(layer.id)
  let beforeId: string | undefined
  for (let i = idx + 1; i < LAYER_ORDER.length; i++) {
    if (map.getLayer(LAYER_ORDER[i])) {
      beforeId = LAYER_ORDER[i]
      break
    }
  }
  map.addLayer(layer, beforeId)
}

export function removeLayers(map: MlMap, ids: readonly string[]) {
  for (const id of ids) if (map.getLayer(id)) map.removeLayer(id)
}

export function removeSource(map: MlMap, id: string) {
  if (map.getSource(id)) map.removeSource(id)
}

export function setGeoJson(map: MlMap, id: string, data: GeoJSON.GeoJSON) {
  const src = map.getSource(id) as GeoJSONSource | undefined
  if (src) src.setData(data)
  else map.addSource(id, { type: 'geojson', data })
}

/* ------------------------------------------------------------ base styles */

/** Plain background style used when the street style cannot load (offline). */
export function fallbackStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': mapColors.canvas } }],
  }
}

export function satelliteAvailable(): boolean {
  return Boolean(MAPTILER_KEY)
}

export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY ?? ''}`],
        tileSize: 256,
        maxzoom: 20,
        attribution: '&copy; MapTiler &copy; OpenStreetMap contributors',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapColors.canvas } },
      { id: 'satellite', type: 'raster', source: 'satellite' },
    ],
  }
}

/* ------------------------------------------------------------- data */

type SlotProps = {
  id: string
  label: string
  zone_id: string
  vehicle_type: VehicleType
  is_accessible: boolean
  has_ev_charger: boolean
}

export function zonesGeoJson(data: EventMapData): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.zones.features.map((f) => ({
      type: 'Feature',
      id: f.id,
      geometry: f.geometry,
      properties: { id: f.id ?? '', code: f.properties.code, name: f.properties.name, color: zoneColor(f.properties.color) },
    })),
  }
}

export function slotsGeoJson(data: EventMapData): GeoJSON.FeatureCollection<GeoJSON.Polygon, SlotProps> {
  return {
    type: 'FeatureCollection',
    features: data.slots.features.map((f) => ({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        id: f.id ?? '',
        label: f.properties.label,
        zone_id: f.properties.zone_id,
        vehicle_type: f.properties.vehicle_type,
        is_accessible: f.properties.is_accessible,
        has_ev_charger: f.properties.has_ev_charger,
      },
    })),
  }
}

export function slotPointsGeoJson(data: EventMapData): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.slots.features.map((f) => {
      const c = centroid(turfPolygon(f.geometry.coordinates))
      return {
        type: 'Feature',
        geometry: c.geometry,
        properties: {
          id: f.id ?? '',
          label: f.properties.label,
          zone_id: f.properties.zone_id,
          vehicle_type: f.properties.vehicle_type,
          icon: f.properties.is_accessible ? IMAGE.accessible : f.properties.has_ev_charger ? IMAGE.ev : '',
        },
      }
    }),
  }
}

export function roadsGeoJson(data: EventMapData): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: data.roads.segments.map((s) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: s.coords },
      properties: { id: s.id, direction: s.direction, walk_only: s.walk_only, name: s.name ?? '' },
    })),
  }
}

/** Representative point inside each zone polygon, for the zone label marker. */
export function zoneLabelPoint(geometry: EventMapData['zones']['features'][number]['geometry']): LngLat {
  const p = pointOnFeature(turfPolygon(geometry.coordinates))
  return [p.geometry.coordinates[0], p.geometry.coordinates[1]]
}

export function slotCenter(data: EventMapData, slotId: string): LngLat | null {
  const f = data.slots.features.find((s) => s.id === slotId)
  if (!f) return null
  const c = centroid(turfPolygon(f.geometry.coordinates))
  return [c.geometry.coordinates[0], c.geometry.coordinates[1]]
}

export type Bbox = [number, number, number, number]

/** Bbox of all zones and gates (the "event" extent). */
export function eventBbox(data: EventMapData, zoneIds?: string[]): Bbox | null {
  const feats: GeoJSON.Feature[] = []
  for (const z of data.zones.features) {
    if (zoneIds && (!z.id || !zoneIds.includes(z.id))) continue
    feats.push({ type: 'Feature', geometry: z.geometry, properties: {} })
  }
  if (!zoneIds) for (const g of data.gates.features) feats.push({ type: 'Feature', geometry: g.geometry, properties: {} })
  if (feats.length === 0) return null
  const b = turfBbox(featureCollection(feats))
  return [b[0], b[1], b[2], b[3]]
}

export function bboxOfPoints(points: LngLat[]): Bbox | null {
  if (points.length === 0) return null
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return [minX, minY, maxX, maxY]
}

/** Buffers a bbox by metres (used for maxBounds: event bbox plus 500 m). */
export function bufferBbox(b: Bbox, metres: number): Bbox {
  const dLat = metres / 111_320
  const midLat = (b[1] + b[3]) / 2
  const dLng = metres / (111_320 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)))
  return [b[0] - dLng, b[1] - dLat, b[2] + dLng, b[3] + dLat]
}

/* ----------------------------------------------------------- expressions */

export type SlotPaintMode = 'status' | 'neutral'

function statusMatch(fallback: string): ExpressionSpecification {
  return [
    'match',
    ['feature-state', 'status'],
    'available',
    slotStatusColors.available,
    'assigned',
    slotStatusColors.assigned,
    'occupied',
    slotStatusColors.occupied,
    'blocked',
    slotStatusColors.blocked,
    fallback,
  ]
}

export function slotFillColor(mode: SlotPaintMode, highlightSlotId: string | null): ExpressionSpecification | string {
  if (mode === 'status') return statusMatch(mapColors.statusOccupiedSoft)
  // Driver screens: other slots stay neutral, only the driver's own slot carries colour.
  return ['case', ['==', ['get', 'id'], highlightSlotId ?? ''], mapColors.statusAssigned, mapColors.statusOccupiedSoft]
}

export function slotFillOpacity(activeTypes: VehicleType[] | null): ExpressionSpecification | number {
  if (!activeTypes) return 0.9
  return ['case', ['in', ['get', 'vehicle_type'], ['literal', activeTypes]], 0.9, 0.25]
}

export function zoneFilter(visibleZoneIds: string[] | null, prop: 'id' | 'zone_id'): FilterSpecification | undefined {
  if (!visibleZoneIds) return undefined
  return ['in', ['get', prop], ['literal', visibleZoneIds]]
}

/* ------------------------------------------------------------ images */

function canvasImage(size: number, draw: (ctx: CanvasRenderingContext2D) => void): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  draw(ctx)
  return ctx.getImageData(0, 0, size, size)
}

function hatchImage(): ImageData | null {
  return canvasImage(16, (ctx) => {
    ctx.strokeStyle = mapColors.muted
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = -16; i <= 32; i += 8) {
      ctx.moveTo(i, 16)
      ctx.lineTo(i + 16, 0)
    }
    ctx.stroke()
  })
}

function arrowImage(): ImageData | null {
  return canvasImage(24, (ctx) => {
    ctx.fillStyle = mapColors.white
    ctx.beginPath()
    ctx.moveTo(20, 12)
    ctx.lineTo(9, 5)
    ctx.lineTo(9, 10)
    ctx.lineTo(3, 10)
    ctx.lineTo(3, 14)
    ctx.lineTo(9, 14)
    ctx.lineTo(9, 19)
    ctx.closePath()
    ctx.fill()
  })
}

/** Small round badge with a glyph for accessible and EV slots, drawn from lucide path data. */
function badgeImage(paths: string[]): ImageData | null {
  return canvasImage(40, (ctx) => {
    ctx.fillStyle = mapColors.white
    ctx.beginPath()
    ctx.arc(20, 20, 19, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(8, 8)
    ctx.strokeStyle = mapColors.ink
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const d of paths) ctx.stroke(new Path2D(d))
  })
}

// lucide `Accessibility` and `Zap` icon paths (24 px grid).
const ACCESSIBLE_PATHS = [
  'M15 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  'm18 19 1-7-6 1',
  'm5 8 3-3 5.5 3-2.36 3.5',
  'M4.24 14.5a5 5 0 0 0 6.88 6',
  'M13.76 17.5a5 5 0 0 0-6.88-6',
]
const EV_PATHS = [
  'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z',
]

export function ensureImages(map: MlMap) {
  const add = (id: string, img: ImageData | null, pixelRatio = 2) => {
    if (!img || map.hasImage(id)) return
    map.addImage(id, img, { pixelRatio })
  }
  add(IMAGE.hatch, hatchImage(), 1)
  add(IMAGE.arrow, arrowImage(), 2)
  add(IMAGE.accessible, badgeImage(ACCESSIBLE_PATHS), 2)
  add(IMAGE.ev, badgeImage(EV_PATHS), 2)
}

/* ------------------------------------------------------ event layers */

export type EventLayerOptions = {
  mode: SlotPaintMode
  highlightSlotId: string | null
  visibleZoneIds: string[] | null
  showRoads: boolean
  activeVehicleTypes: VehicleType[] | null
}

export const EVENT_LAYER_IDS: LayerId[] = [
  'zones-fill',
  'zones-line',
  'roads-casing',
  'roads-line',
  'roads-oneway-arrows',
  'slots-fill',
  'slots-hatch',
  'slots-line',
  'slots-highlight',
  'slots-label',
  'slots-icons',
]

function iconFilter(sf: FilterSpecification | undefined): FilterSpecification {
  const hasIcon: FilterSpecification = ['!=', ['get', 'icon'], '']
  return sf ? (['all', hasIcon, sf] as FilterSpecification) : hasIcon
}

export function addEventSources(map: MlMap, data: EventMapData) {
  setGeoJson(map, SOURCE.zones, zonesGeoJson(data))
  setGeoJson(map, SOURCE.roads, roadsGeoJson(data))
  const slots = slotsGeoJson(data)
  const src = map.getSource(SOURCE.slots) as GeoJSONSource | undefined
  if (src) src.setData(slots)
  else map.addSource(SOURCE.slots, { type: 'geojson', data: slots, promoteId: 'id' })
  setGeoJson(map, SOURCE.slotPoints, slotPointsGeoJson(data))
}

export function addEventLayers(map: MlMap, o: EventLayerOptions) {
  ensureImages(map)
  const zf = zoneFilter(o.visibleZoneIds, 'id')
  const sf = zoneFilter(o.visibleZoneIds, 'zone_id')
  const withFilter = <T extends object>(layer: T, f: FilterSpecification | undefined): T => (f ? { ...layer, filter: f } : layer)

  addLayerOrdered(
    map,
    withFilter(
      { id: 'zones-fill', type: 'fill', source: SOURCE.zones, paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 } },
      zf,
    ),
  )
  addLayerOrdered(
    map,
    withFilter(
      { id: 'zones-line', type: 'line', source: SOURCE.zones, paint: { 'line-color': ['get', 'color'], 'line-width': 2 } },
      zf,
    ),
  )
  const roadVisibility = o.showRoads ? 'visible' : 'none'
  addLayerOrdered(map, {
    id: 'roads-casing',
    type: 'line',
    source: SOURCE.roads,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: roadVisibility },
    paint: { 'line-color': mapColors.white, 'line-width': 9 },
  })
  addLayerOrdered(map, {
    id: 'roads-line',
    type: 'line',
    source: SOURCE.roads,
    layout: { 'line-join': 'round', 'line-cap': 'round', visibility: roadVisibility },
    paint: {
      'line-color': mapColors.mapRoad,
      'line-width': 6,
      'line-dasharray': ['case', ['get', 'walk_only'], ['literal', [1, 1]], ['literal', [1, 0]]],
    },
  })
  addLayerOrdered(map, {
    id: 'roads-oneway-arrows',
    type: 'symbol',
    source: SOURCE.roads,
    filter: ['==', ['get', 'direction'], 'one_way'],
    layout: {
      visibility: roadVisibility,
      'symbol-placement': 'line',
      'symbol-spacing': 40,
      'icon-image': IMAGE.arrow,
      'icon-size': 0.8,
      'icon-allow-overlap': true,
      'icon-rotation-alignment': 'map',
    },
  })
  addLayerOrdered(
    map,
    withFilter(
      {
        id: 'slots-fill',
        type: 'fill',
        source: SOURCE.slots,
        paint: {
          'fill-color': slotFillColor(o.mode, o.highlightSlotId),
          'fill-opacity': slotFillOpacity(o.activeVehicleTypes),
        },
      },
      sf,
    ),
  )
  addLayerOrdered(
    map,
    withFilter(
      {
        id: 'slots-hatch',
        type: 'fill',
        source: SOURCE.slots,
        paint: {
          'fill-pattern': IMAGE.hatch,
          'fill-opacity': o.mode === 'status' ? ['case', ['==', ['feature-state', 'status'], 'blocked'], 1, 0] : 0,
        },
      },
      sf,
    ),
  )
  addLayerOrdered(
    map,
    withFilter(
      { id: 'slots-line', type: 'line', source: SOURCE.slots, paint: { 'line-color': mapColors.white, 'line-width': 1 } },
      sf,
    ),
  )
  addLayerOrdered(map, {
    id: 'slots-highlight',
    type: 'line',
    source: SOURCE.slots,
    filter: ['==', ['get', 'id'], o.highlightSlotId ?? ''],
    paint: { 'line-color': mapColors.primary, 'line-width': 3 },
  })
  addLayerOrdered(
    map,
    withFilter(
      {
        id: 'slots-label',
        type: 'symbol',
        source: SOURCE.slotPoints,
        minzoom: SLOT_DETAIL_ZOOM,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': MAP_FONT,
          'text-size': 11,
          'text-allow-overlap': false,
          'text-offset': ['case', ['!=', ['get', 'icon'], ''], ['literal', [0, 0.9]], ['literal', [0, 0]]],
        },
        paint: { 'text-color': mapColors.ink, 'text-halo-color': mapColors.white, 'text-halo-width': 1.2 },
      },
      sf,
    ),
  )
  addLayerOrdered(map, {
    id: 'slots-icons',
    type: 'symbol',
    source: SOURCE.slotPoints,
    minzoom: SLOT_DETAIL_ZOOM,
    filter: iconFilter(sf),
    layout: { 'icon-image': ['get', 'icon'], 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-offset': [0, -12] },
  })
}

/** Applies option changes to existing layers without rebuilding sources. */
export function updateEventLayers(map: MlMap, o: EventLayerOptions) {
  if (!map.getLayer('slots-fill')) return
  map.setPaintProperty('slots-fill', 'fill-color', slotFillColor(o.mode, o.highlightSlotId))
  map.setPaintProperty('slots-fill', 'fill-opacity', slotFillOpacity(o.activeVehicleTypes))
  map.setFilter('slots-highlight', ['==', ['get', 'id'], o.highlightSlotId ?? ''])
  const vis = o.showRoads ? 'visible' : 'none'
  for (const id of ['roads-casing', 'roads-line', 'roads-oneway-arrows']) map.setLayoutProperty(id, 'visibility', vis)
  const zf = zoneFilter(o.visibleZoneIds, 'id') ?? null
  const sf = zoneFilter(o.visibleZoneIds, 'zone_id') ?? null
  map.setFilter('zones-fill', zf)
  map.setFilter('zones-line', zf)
  for (const id of ['slots-fill', 'slots-hatch', 'slots-line', 'slots-label']) map.setFilter(id, sf)
  map.setFilter('slots-icons', iconFilter(sf ?? undefined))
}

export function applySlotStatuses(map: MlMap, statuses: Map<string, SlotStatus>, previous: Map<string, SlotStatus> | null) {
  if (!map.getSource(SOURCE.slots)) return
  for (const [id, status] of statuses) {
    if (previous && previous.get(id) === status) continue
    map.setFeatureState({ source: SOURCE.slots, id }, { status })
  }
}
