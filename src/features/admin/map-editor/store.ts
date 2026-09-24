import { create } from 'zustand'
import type { BaseMapKind, LngLat } from '@/types/domain'
import type { RoadLine } from '@/lib/geo/roadGraph'
import type { SlotAngle, SlotRowVehicleType, SlotSide } from '@/lib/geo/slotGenerator'
import type { OverlayRow, UpsertGateInput, UpsertLandmarkInput, UpsertZoneInput } from './api'

export type EditorTool = 'select' | 'zone' | 'slotRow' | 'slot' | 'road' | 'gate' | 'landmark' | 'overlay'

export type SelectionKind = 'zone' | 'slot' | 'road' | 'gate' | 'landmark' | 'overlay'

export type EditorLayers = {
  zones: boolean
  slots: boolean
  roads: boolean
  gates: boolean
  landmarks: boolean
  overlay: boolean
  labels: boolean
}

export type SlotGeneratorConfig = {
  vehicleType: SlotRowVehicleType
  width: number
  depth: number
  angle: SlotAngle
  side: SlotSide
  gap: number
  count: number
  fit: boolean
  startNumber: number
  accessible: boolean
  ev: boolean
}

export const DEFAULT_GENERATOR_CONFIG: SlotGeneratorConfig = {
  vehicleType: 'car',
  width: 2.5,
  depth: 5.0,
  angle: 90,
  side: 'left',
  gap: 0,
  count: 10,
  fit: true,
  startNumber: 1,
  accessible: false,
  ev: false,
}

function sameRoadLines(a: RoadLine[], b: RoadLine[]): boolean {
  return a.length === b.length && a.every((line, index) => {
    const other = b[index]
    return Boolean(other) &&
      line.direction === other.direction &&
      line.name === other.name &&
      line.walk_only === other.walk_only &&
      JSON.stringify(line.coords) === JSON.stringify(other.coords)
  })
}

export type EditorState = {
  tool: EditorTool
  selectedKind: SelectionKind | null
  selectedIds: string[]
  dirty: Record<string, 'new' | 'changed' | 'deleted'>
  roadsDirty: boolean
  layers: EditorLayers
  baseLayer: BaseMapKind
  activeZoneId: string | null
  snapping: boolean
  savedAt: string | null
  pointerCoord: LngLat | null

  // Drafts in progress
  draftPoints: LngLat[]
  baselinePoints: [LngLat, LngLat] | null
  generatorConfig: SlotGeneratorConfig
  draftZone: Partial<UpsertZoneInput> | null
  draftGate: Partial<UpsertGateInput> | null
  draftLandmark: Partial<UpsertLandmarkInput> | null
  draftOverlay: Partial<OverlayRow> | null
  activeRoadLine: RoadLine | null
  drawnRoadLines: RoadLine[]

  // Actions
  setTool: (tool: EditorTool) => void
  setSelected: (kind: SelectionKind | null, ids: string[]) => void
  toggleSelectId: (kind: SelectionKind, id: string) => void
  clearSelection: () => void
  setLayers: (layers: Partial<EditorLayers>) => void
  setBaseLayer: (baseLayer: BaseMapKind) => void
  setActiveZoneId: (zoneId: string | null) => void
  setSnapping: (snapping: boolean) => void
  toggleSnapping: () => void
  setRoadsDirty: (dirty: boolean) => void
  setSavedAt: (time: string | null) => void
  setPointerCoord: (coord: LngLat | null) => void
  markDirty: (id: string, state: 'new' | 'changed' | 'deleted') => void
  clearDirty: (id: string) => void

  setDraftPoints: (points: LngLat[]) => void
  addDraftPoint: (point: LngLat) => void
  clearDraftPoints: () => void
  setBaselinePoints: (pts: [LngLat, LngLat] | null) => void
  setGeneratorConfig: (cfg: Partial<SlotGeneratorConfig>) => void
  setDraftZone: (zone: Partial<UpsertZoneInput> | null) => void
  setDraftGate: (gate: Partial<UpsertGateInput> | null) => void
  setDraftLandmark: (landmark: Partial<UpsertLandmarkInput> | null) => void
  setDraftOverlay: (overlay: Partial<OverlayRow> | null) => void
  setActiveRoadLine: (line: RoadLine | null) => void
  setDrawnRoadLines: (lines: RoadLine[]) => void
  addDrawnRoadLine: (line: RoadLine) => void
  reset: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  selectedKind: null,
  selectedIds: [],
  dirty: {},
  roadsDirty: false,
  layers: {
    zones: true,
    slots: true,
    roads: true,
    gates: true,
    landmarks: true,
    overlay: true,
    labels: true,
  },
  baseLayer: 'street',
  activeZoneId: null,
  snapping: true,
  savedAt: null,
  pointerCoord: null,

  draftPoints: [],
  baselinePoints: null,
  generatorConfig: DEFAULT_GENERATOR_CONFIG,
  draftZone: null,
  draftGate: null,
  draftLandmark: null,
  draftOverlay: null,
  activeRoadLine: null,
  drawnRoadLines: [],

  setTool: (tool) =>
    set({
      tool,
      draftPoints: [],
      baselinePoints: null,
      draftZone: null,
      draftGate: null,
      draftLandmark: null,
      activeRoadLine: null,
    }),

  setSelected: (kind, ids) =>
    set({
      selectedKind: kind,
      selectedIds: ids,
      draftPoints: [],
      baselinePoints: null,
    }),

  toggleSelectId: (kind, id) =>
    set((s) => {
      if (s.selectedKind !== kind) {
        return { selectedKind: kind, selectedIds: [id] }
      }
      const has = s.selectedIds.includes(id)
      const next = has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]
      return { selectedKind: next.length > 0 ? kind : null, selectedIds: next }
    }),

  clearSelection: () => set({ selectedKind: null, selectedIds: [] }),

  setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
  setBaseLayer: (baseLayer) => set({ baseLayer }),
  setActiveZoneId: (activeZoneId) => set({ activeZoneId }),
  setSnapping: (snapping) => set({ snapping }),
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  setRoadsDirty: (roadsDirty) => set({ roadsDirty }),
  setSavedAt: (savedAt) => set({ savedAt }),
  setPointerCoord: (pointerCoord) => set({ pointerCoord }),

  markDirty: (id, state) => set((s) => ({ dirty: { ...s.dirty, [id]: state } })),
  clearDirty: (id) =>
    set((s) => {
      const next = { ...s.dirty }
      delete next[id]
      return { dirty: next }
    }),

  setDraftPoints: (draftPoints) => set({ draftPoints }),
  addDraftPoint: (p) => set((s) => ({ draftPoints: [...s.draftPoints, p] })),
  clearDraftPoints: () => set({ draftPoints: [] }),
  setBaselinePoints: (baselinePoints) => set({ baselinePoints }),
  setGeneratorConfig: (patch) => set((s) => ({ generatorConfig: { ...s.generatorConfig, ...patch } })),
  setDraftZone: (draftZone) => set({ draftZone }),
  setDraftGate: (draftGate) => set({ draftGate }),
  setDraftLandmark: (draftLandmark) => set({ draftLandmark }),
  setDraftOverlay: (draftOverlay) => set({ draftOverlay }),
  setActiveRoadLine: (activeRoadLine) => set({ activeRoadLine }),
  setDrawnRoadLines: (drawnRoadLines) =>
    set((state) => (sameRoadLines(state.drawnRoadLines, drawnRoadLines) ? state : { drawnRoadLines })),
  addDrawnRoadLine: (line) =>
    set((s) => ({
      drawnRoadLines: [...s.drawnRoadLines, line],
      roadsDirty: true,
    })),

  reset: () =>
    set({
      tool: 'select',
      selectedKind: null,
      selectedIds: [],
      dirty: {},
      roadsDirty: false,
      draftPoints: [],
      baselinePoints: null,
      draftZone: null,
      draftGate: null,
      draftLandmark: null,
      draftOverlay: null,
      activeRoadLine: null,
      savedAt: null,
      pointerCoord: null,
    }),
}))
