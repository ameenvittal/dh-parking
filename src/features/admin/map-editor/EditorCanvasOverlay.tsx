import { useEffect, useRef } from 'react'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { distance, point } from '@turf/turf'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { EventMapData, LngLat, PolygonGeometry } from '@/types/domain'
import { useMapContext } from '@/features/map/mapContext'
import { snapPoint } from '@/lib/geo/snapping'
import { generateSlotRow, type GeneratedSlot } from '@/lib/geo/slotGenerator'
import { isValidPolygon, slotInsideZone, slotOverlaps } from '@/lib/geo/validation'
import { useEditorStore } from './store'

type EditorCanvasOverlayProps = {
  eventMap: EventMapData
  onGeneratedSlotsChange: (slots: GeneratedSlot[], invalidCount: number) => void
}

const DRAFT_SOURCE_ID = 'editor-canvas-drafts'
const ROAD_PREVIEW_SOURCE_ID = 'editor-road-preview'
const ROAD_PREVIEW_LAYER_ID = 'editor-road-preview-line'

export function EditorCanvasOverlay({
  eventMap,
  onGeneratedSlotsChange,
}: EditorCanvasOverlayProps) {
  const { t } = useTranslation('admin')
  const { map, styleVersion } = useMapContext()
  const {
    tool,
    setTool,
    activeZoneId,
    setActiveZoneId,
    selectedKind,
    selectedIds,
    setSelected,
    snapping,
    setPointerCoord,
    draftPoints,
    addDraftPoint,
    clearDraftPoints,
    baselinePoints,
    setBaselinePoints,
    generatorConfig,
    draftZone,
    setDraftZone,
    setDraftGate,
    setDraftLandmark,
    drawnRoadLines,
    addDrawnRoadLine,
    activeRoadLine,
  } = useEditorStore()

  // Keep ref of latest state to avoid stale closures in MapLibre event handlers
  const stateRef = useRef({
    tool,
    activeZoneId,
    snapping,
    draftPoints,
    baselinePoints,
    generatorConfig,
    draftZone,
    drawnRoadLines,
    activeRoadLine,
    selectedKind,
    selectedIds,
  })
  useEffect(() => {
    stateRef.current = {
      tool,
      activeZoneId,
      snapping,
      draftPoints,
      baselinePoints,
      generatorConfig,
      draftZone,
      drawnRoadLines,
      activeRoadLine,
      selectedKind,
      selectedIds,
    }
  })

  // Calculate generated slot row whenever baseline or generator config changes
  useEffect(() => {
    if (!baselinePoints || tool !== 'slotRow') {
      onGeneratedSlotsChange([], 0)
      return
    }
    const zone = eventMap.zones.features.find((z) => z.id === activeZoneId)
    if (!zone) {
      onGeneratedSlotsChange([], 0)
      return
    }

    try {
      const generated = generateSlotRow({
        a: baselinePoints[0],
        b: baselinePoints[1],
        vehicleType: generatorConfig.vehicleType,
        width: generatorConfig.width,
        depth: generatorConfig.depth,
        angle: generatorConfig.angle,
        side: generatorConfig.side,
        gap: generatorConfig.gap,
        count: generatorConfig.count,
        fit: generatorConfig.fit,
        startNumber: generatorConfig.startNumber,
        accessible: generatorConfig.accessible,
        ev: generatorConfig.ev,
      })

      const existingZoneSlots = eventMap.slots.features
        .filter((s) => s.properties.zone_id === activeZoneId)
        .map((s) => s.geometry)

      let invalid = 0
      generated.forEach((slot, idx) => {
        const otherGenSlots = generated.filter((_, i) => i !== idx).map((s) => s.geometry)
        const inside = slotInsideZone(slot.geometry, zone.geometry)
        const overlap = slotOverlaps(slot.geometry, [...existingZoneSlots, ...otherGenSlots])
        if (!inside || overlap) invalid++
      })

      onGeneratedSlotsChange(generated, invalid)
    } catch {
      onGeneratedSlotsChange([], 0)
    }
  }, [baselinePoints, generatorConfig, tool, activeZoneId, eventMap, onGeneratedSlotsChange])

  // Setup Draft GeoJSON layers on MapLibre
  useEffect(() => {
    if (!map || styleVersion === 0) return

    if (!map.getSource(DRAFT_SOURCE_ID)) {
      map.addSource(DRAFT_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getSource(ROAD_PREVIEW_SOURCE_ID)) {
      map.addSource(ROAD_PREVIEW_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(ROAD_PREVIEW_LAYER_ID)) {
      map.addLayer({
        id: ROAD_PREVIEW_LAYER_ID,
        type: 'line',
        source: ROAD_PREVIEW_SOURCE_ID,
        paint: {
          'line-color': '#7C8698',
          'line-width': 6,
          'line-dasharray': [2, 1.5],
        },
      })
    }

    // Line layer for drafts (dashed line)
    if (!map.getLayer('editor-draft-line')) {
      map.addLayer({
        id: 'editor-draft-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        paint: {
          'line-color': '#1F4FD6',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
        filter: ['==', '$type', 'LineString'],
      })
    }

    // Polygon fill for drafts
    if (!map.getLayer('editor-draft-fill')) {
      map.addLayer({
        id: 'editor-draft-fill',
        type: 'fill',
        source: DRAFT_SOURCE_ID,
        paint: {
          'fill-color': '#1F4FD6',
          'fill-opacity': 0.15,
        },
        filter: ['==', '$type', 'Polygon'],
      })
    }

    // Point layer for draft vertices
    if (!map.getLayer('editor-draft-points')) {
      map.addLayer({
        id: 'editor-draft-points',
        type: 'circle',
        source: DRAFT_SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': '#1F4FD6',
          'circle-stroke-width': 2,
        },
        filter: ['==', '$type', 'Point'],
      })
    }

    // Selection highlight outline
    if (!map.getLayer('editor-selection-line')) {
      map.addLayer({
        id: 'editor-selection-line',
        type: 'line',
        source: DRAFT_SOURCE_ID,
        paint: {
          'line-color': '#1F4FD6',
          'line-width': 3.5,
        },
        filter: ['==', 'isSelection', true],
      })
    }
  }, [map, styleVersion])

  // New roads are kept client-side until the whole network is saved. Render
  // them immediately so a completed line does not appear to disappear.
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const source = map.getSource(ROAD_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    const persistedRoadCount = eventMap.roads.segments.length
    source.setData({
      type: 'FeatureCollection',
      features: drawnRoadLines.slice(persistedRoadCount).map((road, offset) => ({
        type: 'Feature',
        properties: { road_index: persistedRoadCount + offset },
        geometry: { type: 'LineString', coordinates: road.coords },
      })),
    })
  }, [map, styleVersion, drawnRoadLines, eventMap.roads.segments.length])

  // Update Draft source data
  useEffect(() => {
    if (!map || styleVersion === 0) return
    const src = map.getSource(DRAFT_SOURCE_ID) as any
    if (!src) return

    const features: GeoJSON.Feature[] = []

    // 1. Points being drawn (e.g. zone vertices or road points)
    draftPoints.forEach((p) => {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: p },
      })
    })

    // 2. Draft line being drawn
    if (draftPoints.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: draftPoints },
      })
    }

    // 3. Draft zone polygon
    if (draftZone?.polygon) {
      features.push({
        type: 'Feature',
        properties: { isSelection: true },
        geometry: draftZone.polygon,
      })
    }

    // 4. Baseline points for slot row
    if (baselinePoints) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [baselinePoints[0], baselinePoints[1]] },
      })
    }

    // 5. Selected zone outline
    if (selectedKind === 'zone' && selectedIds[0]) {
      const z = eventMap.zones.features.find((zone) => zone.id === selectedIds[0])
      if (z) {
        features.push({
          type: 'Feature',
          properties: { isSelection: true },
          geometry: z.geometry,
        })
      }
    }

    // 6. Selected slot(s) outline
    if (selectedKind === 'slot' && selectedIds.length > 0) {
      eventMap.slots.features
        .filter((s) => (s.id ? selectedIds.includes(s.id) : false))
        .forEach((s) => {
          features.push({
            type: 'Feature',
            properties: { isSelection: true },
            geometry: s.geometry,
          })
        })
    }

    // 7. Selected road outline. Road selections use the matching line index so
    // the properties panel can edit the same draft that will be saved.
    if (selectedKind === 'road' && selectedIds[0]) {
      const roadIndex = Number(selectedIds[0])
      const road = Number.isInteger(roadIndex) ? drawnRoadLines[roadIndex] : null
      if (road) {
        features.push({
          type: 'Feature',
          properties: { isSelection: true },
          geometry: { type: 'LineString', coordinates: road.coords },
        })
      }
    }

    src.setData({ type: 'FeatureCollection', features })
  }, [map, styleVersion, draftPoints, draftZone, baselinePoints, selectedKind, selectedIds, drawnRoadLines, eventMap])

  // Map pointer and click interactions
  useEffect(() => {
    if (!map) return

    const canvas = map.getCanvas()

    const onMouseMove = (e: MapLayerMouseEvent) => {
      const lngLat: LngLat = [e.lngLat.lng, e.lngLat.lat]
      setPointerCoord(lngLat)

      const currentTool = stateRef.current.tool
      if (['zone', 'slotRow', 'slot', 'road', 'gate', 'landmark'].includes(currentTool)) {
        canvas.style.cursor = 'crosshair'
      } else {
        canvas.style.cursor = ''
      }
    }

    const onClick = (e: MapLayerMouseEvent) => {
      const current = stateRef.current
      const rawCoord: LngLat = [e.lngLat.lng, e.lngLat.lat]

      // Apply snapping if road or tool supports it
      let coord = rawCoord
      if (current.snapping) {
        const roadCoords = [
          ...eventMap.roads.segments.map((s) => s.coords),
          ...current.drawnRoadLines.map((r) => r.coords),
        ]
        const snapped = snapPoint(rawCoord, roadCoords, 3)
        coord = snapped.coord
      }

      // 1. SELECT TOOL
      if (current.tool === 'select') {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['slots-fill', 'zones-fill', 'roads-line', ROAD_PREVIEW_LAYER_ID]
            .filter((id) => Boolean(map.getLayer(id))),
        })

        if (features.length > 0) {
          const f = features[0]
          const layerId = f.layer?.id

          if (layerId === 'slots-fill' && f.properties?.id) {
            setSelected('slot', [f.properties.id])
            if (f.properties.zone_id) setActiveZoneId(f.properties.zone_id)
            return
          }

          if (layerId === 'zones-fill' && f.properties?.id) {
            setSelected('zone', [f.properties.id])
            setActiveZoneId(f.properties.id)
            return
          }

          if (layerId === 'roads-line') {
            const roadId = f.properties?.id
            const roadIndex = typeof roadId === 'string'
              ? eventMap.roads.segments.findIndex((road) => road.id === roadId)
              : -1
            if (roadIndex >= 0 && current.drawnRoadLines[roadIndex]) {
              setSelected('road', [String(roadIndex)])
              return
            }
          }

          if (layerId === ROAD_PREVIEW_LAYER_ID) {
            const roadIndex = Number(f.properties?.road_index)
            if (Number.isInteger(roadIndex) && current.drawnRoadLines[roadIndex]) {
              setSelected('road', [String(roadIndex)])
              return
            }
          }
        }

        // Check if gate clicked
        for (const g of eventMap.gates.features) {
          if (distance(point(rawCoord), point(g.geometry.coordinates), { units: 'meters' }) < 12) {
            if (g.id) setSelected('gate', [g.id])
            return
          }
        }

        // Check if landmark clicked
        for (const l of eventMap.landmarks.features) {
          if (distance(point(rawCoord), point(l.geometry.coordinates), { units: 'meters' }) < 12) {
            if (l.id) setSelected('landmark', [l.id])
            return
          }
        }

        setSelected(null, [])
        return
      }

      // 2. ZONE TOOL
      if (current.tool === 'zone') {
        const points = current.draftPoints
        if (points.length >= 3) {
          const distToStart = distance(point(coord), point(points[0]), { units: 'meters' })
          if (distToStart < 12) {
            const closedCoords = [...points, points[0]]
            const poly: PolygonGeometry = { type: 'Polygon', coordinates: [closedCoords] }

            if (isValidPolygon(poly)) {
              setTool('select')
              setDraftZone({
                eventId: eventMap.event.id,
                code: '',
                name: '',
                color: 'zone-1',
                vehicle_types: ['car', 'bike'],
                categories: [],
                is_overflow: false,
                priority: 1,
                polygon: poly,
              })
              setSelected('zone', ['draft'])
            } else {
              toast.error(t('editor.validation.invalidPolygon'))
            }
            clearDraftPoints()
            return
          }
        }
        addDraftPoint(coord)
        return
      }

      // 3. SLOT ROW TOOL
      if (current.tool === 'slotRow') {
        if (!current.activeZoneId) {
          toast.error(t('editor.selectZoneFirst'))
          setTool('select')
          return
        }

        if (!current.baselinePoints) {
          if (current.draftPoints.length === 0) {
            addDraftPoint(coord)
          } else {
            const ptA = current.draftPoints[0]
            const ptB = coord
            setBaselinePoints([ptA, ptB])
            clearDraftPoints()
          }
        }
        return
      }

      // 4. SINGLE SLOT TOOL
      if (current.tool === 'slot') {
        if (!current.activeZoneId) {
          toast.error(t('editor.selectZoneFirst'))
          setTool('select')
          return
        }

        const halfW = 0.000012
        const halfD = 0.000025
        const [lng, lat] = coord
        const poly: PolygonGeometry = {
          type: 'Polygon',
          coordinates: [
            [
              [lng - halfW, lat - halfD],
              [lng + halfW, lat - halfD],
              [lng + halfW, lat + halfD],
              [lng - halfW, lat + halfD],
              [lng - halfW, lat - halfD],
            ],
          ],
        }

        const zone = eventMap.zones.features.find((z) => z.id === current.activeZoneId)
        if (zone && !slotInsideZone(poly, zone.geometry)) {
          toast.error(t('editor.slots.outsideZone'))
          return
        }

        setTool('select')
        return
      }

      // 5. ROAD TOOL
      if (current.tool === 'road') {
        addDraftPoint(coord)
        return
      }

      // 6. GATE TOOL
      if (current.tool === 'gate') {
        setTool('select')
        setDraftGate({
          eventId: eventMap.event.id,
          name: '',
          name_ml: null,
          kind: 'both',
          point: { type: 'Point', coordinates: coord },
        })
        setSelected('gate', ['draft'])
        return
      }

      // 7. LANDMARK TOOL
      if (current.tool === 'landmark') {
        setTool('select')
        setDraftLandmark({
          eventId: eventMap.event.id,
          name: '',
          name_ml: null,
          kind: 'venue',
          point: { type: 'Point', coordinates: coord },
        })
        setSelected('landmark', ['draft'])
        return
      }
    }

    const onDblClick = (e: MapLayerMouseEvent) => {
      const current = stateRef.current

      if (current.tool === 'road' && current.draftPoints.length >= 1) {
        e.preventDefault()
        const end: LngLat = [e.lngLat.lng, e.lngLat.lat]
        const coords = [...current.draftPoints]
        const last = coords[coords.length - 1]
        if (!last || distance(point(last), point(end), { units: 'meters' }) > 0.1) coords.push(end)
        const uniqueCoords = coords.filter((coord, index) =>
          index === 0 || distance(point(coords[index - 1]), point(coord), { units: 'meters' }) > 0.1,
        )
        if (uniqueCoords.length < 2) return
        const roadIndex = current.drawnRoadLines.length
        addDrawnRoadLine({
          coords: uniqueCoords,
          direction: 'two_way',
          name: null,
          walk_only: false,
        })
        clearDraftPoints()
        setTool('select')
        setSelected('road', [String(roadIndex)])
      }
    }

    map.on('mousemove', onMouseMove)
    map.on('click', onClick)
    map.on('dblclick', onDblClick)

    return () => {
      map.off('mousemove', onMouseMove)
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
    }
  }, [map, eventMap, t, setPointerCoord, addDraftPoint, clearDraftPoints, setBaselinePoints, setDraftZone, setDraftGate, setDraftLandmark, setSelected, setTool, setActiveZoneId, addDrawnRoadLine])

  return null
}
