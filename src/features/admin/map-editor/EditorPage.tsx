import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Map as MlMap } from 'maplibre-gl'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { EventListItem } from '@/lib/demo/types'
import { queryKeys } from '@/lib/queryKeys'
import { BaseMap } from '@/features/map/BaseMap'
import { useMapContext } from '@/features/map/mapContext'
import { useMapData } from '@/features/map/useMapData'
import { buildRoadNetwork, validateConnectivity, type RoadLine } from '@/lib/geo/roadGraph'
import { isValidPolygon, zoneAreaOk } from '@/lib/geo/validation'
import type { GeneratedSlot } from '@/lib/geo/slotGenerator'
import type { LngLat } from '@/types/domain'
import { RequireEvent } from '../components/RequireEvent'
import {
  deleteGate,
  deleteLandmark,
  deleteOverlay,
  deleteSlots,
  deleteZone,
  listOverlays,
  saveRoadNetwork,
  setSlotsProps,
  setSlotsStatus,
  updateEventCenter,
  upsertGate,
  upsertLandmark,
  upsertOverlay,
  upsertSlots,
  upsertZone,
  type UpsertGateInput,
  type UpsertLandmarkInput,
  type UpsertZoneInput,
} from './api'
import { EditorCanvasOverlay } from './EditorCanvasOverlay'
import { EditorPropertiesPanel } from './EditorPropertiesPanel'
import { EditorStatusBar } from './EditorStatusBar'
import { EditorToolbar } from './EditorToolbar'
import { EditorTopBar } from './EditorTopBar'
import { useEditorStore } from './store'

const DARUL_HUDA_COORDS: LngLat = [75.9075, 11.0504]

function MapInstanceCapture({ onMap }: { onMap: (map: MlMap) => void }) {
  const { map } = useMapContext()
  useEffect(() => {
    if (map) onMap(map)
  }, [map, onMap])
  return null
}

/** Map editor `/admin/map-editor` (docs/05 section 3, docs/07 section 5.5, F-MAP-01 to F-MAP-09). */
export function EditorPage() {
  return <RequireEvent>{(event) => <EditorView event={event} />}</RequireEvent>
}

function EditorView({ event }: { event: EventListItem }) {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const { eventMap, slotRows, isLoading, error, refetch } = useMapData(event.id)

  const {
    tool,
    setTool,
    selectedKind,
    selectedIds,
    clearSelection,
    activeZoneId,
    setActiveZoneId,
    baseLayer,
    layers,
    setRoadsDirty,
    setSavedAt,
    drawnRoadLines,
    setDrawnRoadLines,
    setBaselinePoints,
    clearDraftPoints,
    setDraftZone,
    setDraftGate,
    setDraftLandmark,
    reset,
  } = useEditorStore()

  // Reset editor store when switching events
  useEffect(() => {
    reset()
  }, [event.id, reset])

  const [mlMap, setMlMap] = useState<MlMap | null>(null)
  const [isSearchingPlace, setIsSearchingPlace] = useState(false)

  // Overlays query
  const overlaysQuery = useQuery({
    queryKey: ['adminOverlays', event.id],
    queryFn: () => listOverlays(event.id),
  })

  // Generated slots from Slot Row tool
  const [generatedSlots, setGeneratedSlots] = useState<GeneratedSlot[]>([])
  const [generatedInvalidCount, setGeneratedInvalidCount] = useState(0)
  const handleGeneratedSlotsChange = useCallback((slots: GeneratedSlot[], invalidCount: number) => {
    setGeneratedSlots((previous) => {
      if (
        previous.length === slots.length &&
        previous.every((slot, index) => JSON.stringify(slot) === JSON.stringify(slots[index]))
      ) {
        return previous
      }
      return slots
    })
    setGeneratedInvalidCount(invalidCount)
  }, [])

  // Delete confirm dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isSavingRoads, setIsSavingRoads] = useState(false)

  // Initialize drawnRoadLines from eventMap roads
  useEffect(() => {
    if (!eventMap?.roads.segments) return
    const lines: RoadLine[] = eventMap.roads.segments.map((s) => ({
      coords: s.coords,
      direction: s.direction,
      name: s.name,
      walk_only: s.walk_only,
    }))
    setDrawnRoadLines(lines)
  }, [eventMap?.roads.segments, setDrawnRoadLines])

  // Stats calculation
  const totalSlots = eventMap?.slots.features.length ?? 0
  const freeSlots = slotRows?.filter((s) => s.status === 'available').length ?? totalSlots
  const accessibleSlots = eventMap?.slots.features.filter((s) => s.properties.is_accessible).length ?? 0
  const segments = eventMap?.roads.segments
  const roadLengthM = useMemo(() => {
    if (!segments) return 0
    return segments.reduce((acc, s) => acc + s.length_m, 0)
  }, [segments])

  // Connectivity warnings
  const warnings = useMemo(() => {
    if (!eventMap) return []
    const gates = eventMap.gates.features.map((g) => ({
      id: g.id ?? '',
      name: g.properties.name,
      location: [g.geometry.coordinates[0], g.geometry.coordinates[1]] as [number, number],
    }))
    const zones = eventMap.zones.features.map((z) => ({
      id: z.id ?? '',
      code: z.properties.code,
      name: z.properties.name,
      area: z.geometry,
    }))
    return validateConnectivity(eventMap.roads, gates, zones)
  }, [eventMap])

  // Active zone code for status bar
  const activeZone = eventMap?.zones.features.find((z) => z.id === activeZoneId)

  // Helper to mark saved time
  const markSaved = useCallback(() => {
    const now = new Date()
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setSavedAt(timeStr)
  }, [setSavedAt])

  // ------------------------- Location / Center --------------------------
  const handleFlyToDarulHuda = () => {
    if (mlMap) {
      mlMap.flyTo({ center: DARUL_HUDA_COORDS, zoom: 17.5 })
      toast.info('Moved view to Darul Huda Islamic University campus')
    }
  }

  const handleSetCenterHere = async () => {
    if (!mlMap) return
    const c = mlMap.getCenter()
    const newCenter: LngLat = [
      Math.round(c.lng * 1e6) / 1e6,
      Math.round(c.lat * 1e6) / 1e6,
    ]
    try {
      await updateEventCenter(event.id, newCenter)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      await qc.invalidateQueries({ queryKey: queryKeys.events() })
      markSaved()
      toast.success(`Event center set to ${newCenter[1]}, ${newCenter[0]}`)
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleSearchPlace = async (query: string) => {
    const qLower = query.toLowerCase()
    if (qLower.includes('darul') || qLower.includes('huda')) {
      handleFlyToDarulHuda()
      return
    }
    setIsSearchingPlace(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      )
      const data = await res.json()
      if (Array.isArray(data) && data[0]) {
        const lon = parseFloat(data[0].lon)
        const lat = parseFloat(data[0].lat)
        if (mlMap && !isNaN(lon) && !isNaN(lat)) {
          mlMap.flyTo({ center: [lon, lat], zoom: 17 })
          toast.info(`Found: ${data[0].display_name}`)
        }
      } else {
        toast.error('Location not found')
      }
    } catch {
      toast.error('Could not search location')
    } finally {
      setIsSearchingPlace(false)
    }
  }

  // -------------------------------- Handlers --------------------------------

  // 1. Zone
  const handleSaveZone = async (input: UpsertZoneInput) => {
    if (!isValidPolygon(input.polygon)) {
      toast.error(t('editor.validation.invalidPolygon'))
      return
    }
    if (!zoneAreaOk(input.polygon)) {
      toast.error(t('editor.zone.areaInvalid'))
      return
    }
    try {
      const saved = await upsertZone(input)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      setActiveZoneId(saved.id)
      setDraftZone(null)
      clearSelection()
      markSaved()
      toast.success(t('editor.zone.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await deleteZone(zoneId)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      if (activeZoneId === zoneId) setActiveZoneId(null)
      clearSelection()
      markSaved()
      toast.success(t('editor.zone.deleted'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 2. Slot Row (Generated slots)
  const handleAddGeneratedSlots = async () => {
    if (!activeZoneId || generatedSlots.length === 0 || generatedInvalidCount > 0) return
    try {
      const inputs = generatedSlots.map((s) => ({
        number: s.properties.number,
        polygon: s.geometry,
        vehicle_type: s.properties.vehicle_type,
        is_accessible: s.properties.is_accessible,
        has_ev_charger: s.properties.has_ev_charger,
      }))
      await upsertSlots(activeZoneId, inputs)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      setBaselinePoints(null)
      setTool('select')
      markSaved()
      toast.success(t('editor.generator.added', { count: inputs.length }))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleCancelSlotRow = () => {
    setBaselinePoints(null)
    clearDraftPoints()
    setTool('select')
  }

  // 3. Slots (single or multi-edit)
  const handleSaveSlots = async (patch: {
    ids: string[]
    vehicleType?: any
    isAccessible?: boolean
    hasEvCharger?: boolean
    status?: any
    blockReason?: string | null
  }) => {
    try {
      if (patch.vehicleType || patch.isAccessible !== undefined || patch.hasEvCharger !== undefined) {
        await setSlotsProps(patch.ids, {
          vehicle_type: patch.vehicleType,
          is_accessible: patch.isAccessible,
          has_ev_charger: patch.hasEvCharger,
        })
      }
      if (patch.status) {
        await setSlotsStatus(patch.ids, patch.status, patch.blockReason ?? null)
      }
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      await qc.invalidateQueries({ queryKey: queryKeys.slotStatuses(event.id) })
      markSaved()
      toast.success(t('editor.slots.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteSlots = async (slotIds: string[]) => {
    try {
      await deleteSlots(slotIds)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      await qc.invalidateQueries({ queryKey: queryKeys.slotStatuses(event.id) })
      clearSelection()
      markSaved()
      toast.success(t('editor.slots.deleted'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 4. Roads
  const handleSaveRoads = async () => {
    if (!eventMap) return
    setIsSavingRoads(true)
    try {
      const { nodes, segments } = buildRoadNetwork(drawnRoadLines, eventMap.roads.nodes)
      await saveRoadNetwork({
        eventId: event.id,
        nodes: nodes.map((n) => ({ id: n.id, coord: n.coord })),
        segments: segments.map((s) => ({
          id: s.id,
          from: s.from,
          to: s.to,
          coords: s.coords,
          direction: s.direction,
          name: s.name,
          walk_only: s.walk_only,
        })),
      })
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      setRoadsDirty(false)
      markSaved()
      toast.success(t('editor.road.saved', { segments: segments.length, nodes: nodes.length }))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setIsSavingRoads(false)
    }
  }

  const handleReverseRoadDirection = (idx: number) => {
    const copy = [...drawnRoadLines]
    if (!copy[idx]) return
    copy[idx] = { ...copy[idx], coords: [...copy[idx].coords].reverse() }
    setDrawnRoadLines(copy)
    setRoadsDirty(true)
  }

  const handleUpdateRoadDirection = (idx: number, direction: any) => {
    const copy = [...drawnRoadLines]
    if (!copy[idx]) return
    copy[idx] = { ...copy[idx], direction }
    setDrawnRoadLines(copy)
    setRoadsDirty(true)
  }

  const handleUpdateRoadWalkOnly = (idx: number, walk_only: boolean) => {
    const copy = [...drawnRoadLines]
    if (!copy[idx]) return
    copy[idx] = { ...copy[idx], walk_only }
    setDrawnRoadLines(copy)
    setRoadsDirty(true)
  }

  const handleUpdateRoadName = (idx: number, name: string) => {
    const copy = [...drawnRoadLines]
    if (!copy[idx]) return
    copy[idx] = { ...copy[idx], name }
    setDrawnRoadLines(copy)
    setRoadsDirty(true)
  }

  const handleDeleteRoad = (idx: number) => {
    const copy = drawnRoadLines.filter((_, i) => i !== idx)
    setDrawnRoadLines(copy)
    setRoadsDirty(true)
    clearSelection()
  }

  // 5. Gates
  const handleSaveGate = async (input: UpsertGateInput) => {
    try {
      await upsertGate(input)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      setDraftGate(null)
      clearSelection()
      markSaved()
      toast.success(t('editor.gate.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteGate = async (gateId: string) => {
    try {
      await deleteGate(gateId)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      clearSelection()
      markSaved()
      toast.success(t('editor.gate.deleted'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 6. Landmarks
  const handleSaveLandmark = async (input: UpsertLandmarkInput) => {
    try {
      await upsertLandmark(input)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      setDraftLandmark(null)
      clearSelection()
      markSaved()
      toast.success(t('editor.landmark.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteLandmark = async (landmarkId: string) => {
    try {
      await deleteLandmark(landmarkId)
      await qc.invalidateQueries({ queryKey: queryKeys.eventMap(event.id) })
      clearSelection()
      markSaved()
      toast.success(t('editor.landmark.deleted'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 7. Overlays
  const handleSaveOverlay = async (input: any) => {
    try {
      await upsertOverlay({
        ...input,
        eventId: event.id,
        corners: input.corners || [
          [event.center[0] - 0.001, event.center[1] + 0.001],
          [event.center[0] + 0.001, event.center[1] + 0.001],
          [event.center[0] + 0.001, event.center[1] - 0.001],
          [event.center[0] - 0.001, event.center[1] - 0.001],
        ],
      })
      await qc.invalidateQueries({ queryKey: ['adminOverlays', event.id] })
      clearSelection()
      markSaved()
      toast.success(t('editor.overlay.saved'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteOverlay = async (overlayId: string) => {
    try {
      await deleteOverlay(overlayId)
      await qc.invalidateQueries({ queryKey: ['adminOverlays', event.id] })
      clearSelection()
      markSaved()
      toast.success(t('editor.overlay.removed'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // 8. Delete selection
  const handleDeleteSelected = useCallback(() => {
    if (selectedKind && selectedIds.length > 0) {
      setDeleteConfirmOpen(true)
    }
  }, [selectedKind, selectedIds])

  const confirmDeleteAction = async () => {
    if (!selectedKind || selectedIds.length === 0) return
    if (selectedKind === 'zone') {
      await handleDeleteZone(selectedIds[0])
    } else if (selectedKind === 'slot') {
      await handleDeleteSlots(selectedIds)
    } else if (selectedKind === 'gate') {
      await handleDeleteGate(selectedIds[0])
    } else if (selectedKind === 'landmark') {
      await handleDeleteLandmark(selectedIds[0])
    } else if (selectedKind === 'road') {
      handleDeleteRoad(parseInt(selectedIds[0], 10))
    }
  }

  // ------------------------- Keyboard Shortcuts -------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }

      const key = e.key.toUpperCase()

      if (key === 'V') setTool('select')
      else if (key === 'Z') setTool('zone')
      else if (key === 'R') setTool('slotRow')
      else if (key === 'S') setTool('slot')
      else if (key === 'D') setTool('road')
      else if (key === 'G') setTool('gate')
      else if (key === 'L') setTool('landmark')
      else if (key === 'I') setTool('overlay')
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedKind && selectedIds.length > 0) {
          e.preventDefault()
          handleDeleteSelected()
        }
      } else if (e.key === 'Escape') {
        clearDraftPoints()
        setBaselinePoints(null)
        clearSelection()
        setTool('select')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedKind, selectedIds, setTool, clearDraftPoints, setBaselinePoints, clearSelection, handleDeleteSelected])

  // ------------------------------ Render --------------------------------

  if (isLoading || !eventMap) {
    return (
      <div className="flex h-full w-full flex-col">
        <Skeleton className="h-14 w-full" />
        <div className="flex flex-1">
          <Skeleton className="h-full w-14" />
          <Skeleton className="h-full flex-1" />
          <Skeleton className="h-full w-80" />
        </div>
      </div>
    )
  }

  if (error) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  return (
    <div className="flex h-full w-full flex-col select-none overflow-hidden">
      {/* Top Bar */}
      <EditorTopBar
        isLive={event.status === 'live'}
        venueName={event.venue_name}
        warnings={warnings}
        onSaveRoads={handleSaveRoads}
        isSavingRoads={isSavingRoads}
        onFlyToDarulHuda={handleFlyToDarulHuda}
        onSetCenterHere={handleSetCenterHere}
        onSearchPlace={handleSearchPlace}
        isSearchingPlace={isSearchingPlace}
      />

      {/* Main Workspace (Toolbar + Map + Properties Panel) */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <EditorToolbar
          onDeleteSelected={handleDeleteSelected}
          hasSelection={Boolean(selectedKind && selectedIds.length > 0)}
        />

        {/* Center: Map Canvas */}
        <div className="relative min-w-0 flex-1 bg-surface-2">
          <BaseMap
            eventMap={eventMap}
            baseLayer={baseLayer}
            interactive={true}
            showRoads={layers.roads}
            onSlotClick={(slotId) => {
              if (tool === 'select') {
                const s = eventMap.slots.features.find((slot) => slot.id === slotId)
                if (s) {
                  useEditorStore.getState().setSelected('slot', [slotId])
                  if (s.properties.zone_id) setActiveZoneId(s.properties.zone_id)
                }
              }
            }}
            className="h-full w-full"
          >
            <MapInstanceCapture onMap={(m) => setMlMap(m)} />
            <EditorCanvasOverlay
              eventMap={eventMap}
              onGeneratedSlotsChange={handleGeneratedSlotsChange}
            />
          </BaseMap>
        </div>

        {/* Right: Properties Panel */}
        <EditorPropertiesPanel
          eventMap={eventMap}
          overlays={overlaysQuery.data ?? []}
          totalSlots={totalSlots}
          freeSlots={freeSlots}
          accessibleSlots={accessibleSlots}
          roadLengthM={roadLengthM}
          generatedSlotsCount={generatedSlots.length}
          generatedInvalidCount={generatedInvalidCount}
          onSaveZone={handleSaveZone}
          onDeleteZone={handleDeleteZone}
          onSaveSlots={handleSaveSlots}
          onDeleteSlots={handleDeleteSlots}
          onAddGeneratedSlots={handleAddGeneratedSlots}
          onCancelSlotRow={handleCancelSlotRow}
          onSaveGate={handleSaveGate}
          onDeleteGate={handleDeleteGate}
          onSaveLandmark={handleSaveLandmark}
          onDeleteLandmark={handleDeleteLandmark}
          onSaveOverlay={handleSaveOverlay}
          onDeleteOverlay={handleDeleteOverlay}
          onReverseRoadDirection={handleReverseRoadDirection}
          onUpdateRoadDirection={handleUpdateRoadDirection}
          onUpdateRoadWalkOnly={handleUpdateRoadWalkOnly}
          onUpdateRoadName={handleUpdateRoadName}
          onDeleteRoad={handleDeleteRoad}
          onFlyToDarulHuda={handleFlyToDarulHuda}
          onSetCenterHere={handleSetCenterHere}
        />
      </div>

      {/* Bottom Status Bar */}
      <EditorStatusBar
        activeZoneCode={activeZone ? activeZone.properties.code : null}
        totalSlots={totalSlots}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('editor.deleteSelectedTitle')}
        description={
          selectedKind === 'zone'
            ? t('editor.zone.deleteBody')
            : undefined
        }
        tone="danger"
        confirmLabel={t('common.delete')}
        onConfirm={confirmDeleteAction}
      />
    </div>
  )
}
