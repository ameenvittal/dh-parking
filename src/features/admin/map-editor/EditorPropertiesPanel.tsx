import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, DoorOpen, Landmark, Layers, MapPin, Route, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  LANDMARK_KINDS,
  VISITOR_CATEGORIES,
  type EventMapData,
  type GateKind,
  type LandmarkKind,
  type RoadDirection,
  type SlotStatus,
  type VehicleType,
  type VisitorCategory,
} from '@/types/domain'
import { zoneColors } from '@/features/map/style/colors'
import { SLOT_DEFAULTS, SLOT_LIMITS, type SlotAngle, type SlotRowVehicleType, type SlotSide } from '@/lib/geo/slotGenerator'
import type { OverlayRow, UpsertGateInput, UpsertLandmarkInput, UpsertZoneInput } from './api'
import { useEditorStore } from './store'

type EditorPropertiesPanelProps = {
  eventMap: EventMapData
  overlays: OverlayRow[]
  totalSlots: number
  freeSlots: number
  accessibleSlots: number
  roadLengthM: number
  generatedSlotsCount: number
  generatedInvalidCount: number
  onSaveZone: (zone: UpsertZoneInput) => void
  onDeleteZone: (zoneId: string) => void
  onSaveSlots: (slots: {
    ids: string[]
    vehicleType?: VehicleType
    isAccessible?: boolean
    hasEvCharger?: boolean
    status?: SlotStatus
    blockReason?: string | null
  }) => void
  onDeleteSlots: (slotIds: string[]) => void
  onAddGeneratedSlots: () => void
  onCancelSlotRow: () => void
  onSaveGate: (gate: UpsertGateInput) => void
  onDeleteGate: (gateId: string) => void
  onSaveLandmark: (landmark: UpsertLandmarkInput) => void
  onDeleteLandmark: (landmarkId: string) => void
  onSaveOverlay: (overlay: Omit<OverlayRow, 'id'> & { id?: string }) => void
  onDeleteOverlay: (overlayId: string) => void
  onReverseRoadDirection: (roadIndex: number) => void
  onUpdateRoadDirection: (roadIndex: number, direction: RoadDirection) => void
  onUpdateRoadWalkOnly: (roadIndex: number, walkOnly: boolean) => void
  onUpdateRoadName: (roadIndex: number, name: string) => void
  onDeleteRoad: (roadIndex: number) => void
  onFlyToDarulHuda: () => void
  onSetCenterHere: () => void
}

export function EditorPropertiesPanel({
  eventMap,
  overlays,
  totalSlots,
  roadLengthM,
  generatedSlotsCount,
  generatedInvalidCount,
  onSaveZone,
  onDeleteZone,
  onSaveSlots,
  onDeleteSlots,
  onAddGeneratedSlots,
  onCancelSlotRow,
  onSaveGate,
  onDeleteGate,
  onSaveLandmark,
  onDeleteLandmark,
  onSaveOverlay,
  onDeleteOverlay,
  onReverseRoadDirection,
  onUpdateRoadDirection,
  onUpdateRoadWalkOnly,
  onUpdateRoadName,
  onDeleteRoad,
  onFlyToDarulHuda,
  onSetCenterHere,
}: EditorPropertiesPanelProps) {
  const { t } = useTranslation('admin')
  const {
    tool,
    selectedKind,
    selectedIds,
    generatorConfig,
    setGeneratorConfig,
    draftZone,
    draftGate,
    draftLandmark,
    draftOverlay,
    drawnRoadLines,
  } = useEditorStore()

  // Selected Zone
  const selectedZone = selectedKind === 'zone' && selectedIds[0]
    ? eventMap.zones.features.find((z) => z.id === selectedIds[0])
    : null

  // Selected Gate
  const selectedGate = selectedKind === 'gate' && selectedIds[0]
    ? eventMap.gates.features.find((g) => g.id === selectedIds[0])
    : null

  // Selected Landmark
  const selectedLandmark = selectedKind === 'landmark' && selectedIds[0]
    ? eventMap.landmarks.features.find((l) => l.id === selectedIds[0])
    : null

  // Selected Overlay
  const selectedOverlay = selectedKind === 'overlay' && selectedIds[0]
    ? overlays.find((o) => o.id === selectedIds[0])
    : null

  // Selected Slots
  const selectedSlots = selectedKind === 'slot'
    ? eventMap.slots.features.filter((s) => (s.id ? selectedIds.includes(s.id) : false))
    : []

  // Selected Road
  const selectedRoadIndex = selectedKind === 'road' && selectedIds[0]
    ? parseInt(selectedIds[0], 10)
    : null
  const selectedRoad = selectedRoadIndex !== null && !isNaN(selectedRoadIndex)
    ? drawnRoadLines[selectedRoadIndex]
    : null

  return (
    <aside
      aria-label="Properties"
      className="flex w-80 shrink-0 flex-col border-l border-line bg-surface overflow-y-auto"
    >
      {/* 1. SLOT ROW GENERATOR MODE */}
      {tool === 'slotRow' ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink">{t('editor.generator.title')}</h2>
            <span className="text-caption text-warning font-medium">
              {t('editor.unsavedFeature')}
            </span>
          </div>

          <Field label={t('editor.generator.vehicleType')}>
            <Select
              value={generatorConfig.vehicleType}
              onChange={(e) => {
                const vt = e.target.value as SlotRowVehicleType
                const defs = SLOT_DEFAULTS[vt]
                setGeneratorConfig({
                  vehicleType: vt,
                  width: defs.width,
                  depth: defs.depth,
                })
              }}
              options={[
                { value: 'car', label: 'Car' },
                { value: 'bike', label: 'Bike' },
                { value: 'ev', label: 'EV' },
                { value: 'bus', label: 'Bus' },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('editor.generator.width')}>
              <Input
                type="number"
                step="0.1"
                min={SLOT_LIMITS.width.min}
                max={SLOT_LIMITS.width.max}
                value={generatorConfig.width}
                onChange={(e) => setGeneratorConfig({ width: parseFloat(e.target.value) || 2.5 })}
              />
            </Field>
            <Field label={t('editor.generator.depth')}>
              <Input
                type="number"
                step="0.1"
                min={SLOT_LIMITS.depth.min}
                max={SLOT_LIMITS.depth.max}
                value={generatorConfig.depth}
                onChange={(e) => setGeneratorConfig({ depth: parseFloat(e.target.value) || 5.0 })}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('editor.generator.angle')}</Label>
            <SegmentedControl<string>
              ariaLabel={t('editor.generator.angle')}
              value={String(generatorConfig.angle)}
              onChange={(v) => setGeneratorConfig({ angle: parseInt(v, 10) as SlotAngle })}
              options={[
                { value: '90', label: '90°' },
                { value: '60', label: '60°' },
                { value: '45', label: '45°' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('editor.generator.side')}</Label>
            <SegmentedControl<SlotSide>
              ariaLabel={t('editor.generator.side')}
              value={generatorConfig.side}
              onChange={(v) => setGeneratorConfig({ side: v })}
              options={[
                { value: 'left', label: t('editor.generator.left') },
                { value: 'right', label: t('editor.generator.right') },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('editor.generator.gap')}>
              <Input
                type="number"
                step="0.1"
                min={SLOT_LIMITS.gap.min}
                max={SLOT_LIMITS.gap.max}
                value={generatorConfig.gap}
                onChange={(e) => setGeneratorConfig({ gap: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label={t('editor.generator.startNumber')}>
              <Input
                type="number"
                min={SLOT_LIMITS.startNumber.min}
                max={SLOT_LIMITS.startNumber.max}
                value={generatorConfig.startNumber}
                onChange={(e) => setGeneratorConfig({ startNumber: parseInt(e.target.value, 10) || 1 })}
              />
            </Field>
          </div>

          <SwitchRow
            label={t('editor.generator.fit')}
            checked={generatorConfig.fit}
            onCheckedChange={(fit) => setGeneratorConfig({ fit })}
          />

          {!generatorConfig.fit && (
            <Field label={t('editor.generator.count')}>
              <Input
                type="number"
                min={SLOT_LIMITS.count.min}
                max={SLOT_LIMITS.count.max}
                value={generatorConfig.count}
                onChange={(e) => setGeneratorConfig({ count: parseInt(e.target.value, 10) || 1 })}
              />
            </Field>
          )}

          <div className="flex flex-col gap-2 pt-2 border-t border-line">
            <SwitchRow
              label={t('editor.generator.accessible')}
              checked={generatorConfig.accessible}
              onCheckedChange={(accessible) => setGeneratorConfig({ accessible })}
            />
            <SwitchRow
              label={t('editor.generator.ev')}
              checked={generatorConfig.ev}
              onCheckedChange={(ev) => setGeneratorConfig({ ev })}
            />
          </div>

          {/* Preview Status & Actions */}
          <div className="flex flex-col gap-2 pt-3 border-t border-line">
            <div className="text-body-sm font-medium">
              {t('editor.generator.preview', {
                count: generatedSlotsCount,
                invalid: generatedInvalidCount,
              })}
            </div>

            <Button
              variant="primary"
              disabled={generatedSlotsCount === 0 || generatedInvalidCount > 0}
              onClick={onAddGeneratedSlots}
            >
              {generatedInvalidCount > 0
                ? t('editor.generator.fixFirst')
                : t('editor.generator.add')}
            </Button>

            <Button variant="ghost" onClick={onCancelSlotRow}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : selectedKind === 'zone' && (selectedZone || draftZone) ? (
        /* 2. ZONE PROPERTIES */
        <ZonePanel
          eventMap={eventMap}
          zone={selectedZone}
          draftZone={draftZone}
          onSave={onSaveZone}
          onDelete={onDeleteZone}
        />
      ) : selectedKind === 'slot' && selectedSlots.length > 0 ? (
        /* 3. SLOT PROPERTIES (Single or Multi) */
        <SlotPanel
          slots={selectedSlots}
          onSave={onSaveSlots}
          onDelete={onDeleteSlots}
        />
      ) : selectedKind === 'road' && selectedRoad !== null ? (
        /* 4. ROAD PROPERTIES */
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-semibold text-ink">{t('editor.road.title')}</h2>
            <span className="text-caption text-warning font-medium">
              {t('editor.unsavedFeature')}
            </span>
          </div>

          <Field label={t('editor.road.name')}>
            <Input
              value={selectedRoad.name ?? ''}
              onChange={(e) => onUpdateRoadName(selectedRoadIndex!, e.target.value)}
              placeholder="e.g. North Avenue"
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Label>{t('editor.road.direction')}</Label>
            <SegmentedControl<RoadDirection>
              ariaLabel={t('editor.road.direction')}
              value={selectedRoad.direction}
              onChange={(dir) => onUpdateRoadDirection(selectedRoadIndex!, dir)}
              options={[
                { value: 'two_way', label: t('editor.road.twoWay') },
                { value: 'one_way', label: t('editor.road.oneWay') },
              ]}
            />
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => onReverseRoadDirection(selectedRoadIndex!)}
          >
            {t('editor.road.reverse')}
          </Button>

          <SwitchRow
            label={t('editor.road.walkOnly')}
            checked={selectedRoad.walk_only}
            onCheckedChange={(walkOnly) => onUpdateRoadWalkOnly(selectedRoadIndex!, walkOnly)}
          />

          <div className="rounded bg-surface-2 p-3 text-caption text-muted">
            {t('editor.road.note')}
          </div>

          <div className="pt-2">
            <Button
              variant="danger-ghost"
              size="sm"
              onClick={() => onDeleteRoad(selectedRoadIndex!)}
              className="gap-1.5"
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>{t('editor.tools.delete')}</span>
            </Button>
          </div>
        </div>
      ) : selectedKind === 'gate' && (selectedGate || draftGate) ? (
        /* 5. GATE PROPERTIES */
        <GatePanel
          gate={selectedGate}
          draftGate={draftGate}
          onSave={onSaveGate}
          onDelete={onDeleteGate}
        />
      ) : selectedKind === 'landmark' && (selectedLandmark || draftLandmark) ? (
        /* 6. LANDMARK PROPERTIES */
        <LandmarkPanel
          landmark={selectedLandmark}
          draftLandmark={draftLandmark}
          onSave={onSaveLandmark}
          onDelete={onDeleteLandmark}
        />
      ) : tool === 'overlay' || selectedKind === 'overlay' ? (
        /* 7. OVERLAY PROPERTIES */
        <OverlayPanel
          overlay={selectedOverlay}
          draftOverlay={draftOverlay}
          onSave={onSaveOverlay}
          onDelete={onDeleteOverlay}
        />
      ) : (
        /* 8. SUMMARY / EMPTY SELECTION */
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-body font-bold text-ink">{t('editor.summary.title')}</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-caption font-semibold text-primary">
              {eventMap.zones.features.length} zones • {totalSlots} slots
            </span>
          </div>

          {/* 2x2 Entity Stats Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 shadow-raised transition-all hover:border-primary/30">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-muted">{t('editor.summary.zones')}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Layers size={13} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>
              <span className="text-h2 font-bold tabular-nums text-ink">
                {eventMap.zones.features.length}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 shadow-raised transition-all hover:border-status-available/30">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-muted">{t('editor.summary.slots')}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-status-available-soft text-status-available">
                  <Square size={13} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>
              <span className="text-h2 font-bold tabular-nums text-ink">
                {totalSlots}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 shadow-raised transition-all hover:border-line-strong">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-muted">{t('editor.summary.gates')}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-surface-2 text-ink">
                  <DoorOpen size={13} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>
              <span className="text-h2 font-bold tabular-nums text-ink">
                {eventMap.gates.features.length}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 shadow-raised transition-all hover:border-warning/30">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-muted">{t('editor.summary.landmarks')}</span>
                <span className="flex size-6 items-center justify-center rounded-md bg-warning-soft text-warning">
                  <Landmark size={13} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </div>
              <span className="text-h2 font-bold tabular-nums text-ink">
                {eventMap.landmarks.features.length}
              </span>
            </div>
          </div>

          {/* Road Network Horizontal Card */}
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-3 shadow-raised">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-surface-2 text-muted">
                <Route size={15} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="flex flex-col">
                <span className="text-body-sm font-semibold text-ink">{t('editor.summary.roadsLength')}</span>
                <span className="text-caption text-muted">Total road network</span>
              </div>
            </div>
            <span className="text-h3 font-bold tabular-nums text-ink">
              {roadLengthM >= 1000
                ? `${(roadLengthM / 1000).toFixed(1)} km`
                : `${Math.round(roadLengthM)} m`}
            </span>
          </div>

          {/* Event Venue & Location Section */}
          <div className="flex flex-col gap-2.5 rounded-lg border border-primary/20 bg-primary-soft/40 p-3.5 shadow-raised">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-primary">
                <MapPin size={14} strokeWidth={2.25} />
                <span className="text-caption font-semibold">Event location</span>
              </div>
              <span className="font-mono text-caption text-muted tabular-nums">
                {eventMap.event.center[1].toFixed(4)}° N, {eventMap.event.center[0].toFixed(4)}° E
              </span>
            </div>
            <p className="text-body-sm font-bold text-ink">
              {eventMap.event.name}
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={onFlyToDarulHuda}
                className="w-full text-caption font-medium hover:border-primary hover:text-primary hover:bg-surface"
              >
                Go to Darul Huda campus
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSetCenterHere}
                className="w-full text-caption text-muted hover:text-ink"
              >
                Set center to current view
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-2/60 p-3 text-caption text-muted">
            {t('editor.summary.instructions')}
          </div>
        </div>
      )}
    </aside>
  )
}

/* --------------------------------- Sub-panels --------------------------------- */

function ZonePanel({
  eventMap,
  zone,
  draftZone,
  onSave,
  onDelete,
}: {
  eventMap: EventMapData
  zone: any
  draftZone: any
  onSave: (z: UpsertZoneInput) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('admin')
  const initial = draftZone || {
    id: zone?.id ?? '',
    eventId: eventMap.event.id,
    code: zone?.properties.code ?? '',
    name: zone?.properties.name ?? '',
    name_ml: zone?.properties.name_ml ?? '',
    color: zone?.properties.color ?? 'zone-1',
    vehicle_types: zone?.properties.vehicle_types ?? ['car'],
    categories: zone?.properties.categories ?? [],
    is_overflow: zone?.properties.is_overflow ?? false,
    priority: zone?.properties.priority ?? 1,
    notes: zone?.properties.notes ?? '',
    polygon: zone?.geometry,
  }

  const [code, setCode] = useState(initial.code)
  const [name, setName] = useState(initial.name)
  const [nameMl, setNameMl] = useState(initial.name_ml ?? '')
  const [color, setColor] = useState(initial.color)
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>(initial.vehicle_types)
  const [categories, setCategories] = useState<VisitorCategory[]>(initial.categories)
  const [isOverflow, setIsOverflow] = useState(initial.is_overflow)
  const [priority, setPriority] = useState(initial.priority)
  const [notes, setNotes] = useState(initial.notes ?? '')

  const zoneSlots = zone ? eventMap.slots.features.filter((s) => s.properties.zone_id === zone.id) : []

  const toggleCategory = (cat: VisitorCategory) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
  }

  const toggleVehicleType = (vt: VehicleType) => {
    setVehicleTypes((prev) =>
      prev.includes(vt) ? prev.filter((t) => t !== vt) : [...prev, vt],
    )
  }

  const handleSave = () => {
    onSave({
      id: zone?.id ?? null,
      eventId: eventMap.event.id,
      code: code.toUpperCase().trim(),
      name: name.trim(),
      name_ml: nameMl.trim() || null,
      color,
      vehicle_types: vehicleTypes,
      categories,
      is_overflow: isOverflow,
      priority,
      notes: notes.trim() || null,
      polygon: initial.polygon,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">
          {zone ? t('editor.zone.title') : t('editor.zone.newTitle')}
        </h2>
        {!zone && (
          <span className="text-caption text-warning font-medium">
            {t('editor.unsavedFeature')}
          </span>
        )}
      </div>

      <Field label={t('editor.zone.code')} helper={t('editor.zone.codeHelper')}>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          placeholder="e.g. A"
        />
      </Field>

      <Field label={t('editor.zone.name')}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. West Parking"
        />
      </Field>

      <Field label={t('editor.zone.nameMl')}>
        <Input
          value={nameMl}
          onChange={(e) => setNameMl(e.target.value)}
          placeholder="e.g. പടിഞ്ഞാറ് പാർക്കിംഗ്"
        />
      </Field>

      {/* Colour palette */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('editor.zone.colour')}</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(zoneColors).map(([token, hex]) => (
            <button
              key={token}
              type="button"
              aria-label={token}
              onClick={() => setColor(token)}
              style={{ backgroundColor: hex }}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-transform',
                color === token ? 'ring-2 ring-focus ring-offset-2 scale-110' : 'hover:scale-105',
              )}
            >
              {color === token && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle types */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('editor.zone.vehicleTypes')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(['car', 'bike', 'ev', 'bus'] as const).map((vt) => (
            <label key={vt} className="flex items-center gap-2 text-body-sm cursor-pointer">
              <Checkbox
                checked={vehicleTypes.includes(vt)}
                onCheckedChange={() => toggleVehicleType(vt)}
              />
              <span>{vt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Visitor categories chips */}
      <div className="flex flex-col gap-1.5">
        <Label>{t('editor.zone.categories')}</Label>
        <span className="text-caption text-muted">{t('editor.zone.categoriesHelper')}</span>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {VISITOR_CATEGORIES.map((cat) => {
            const active = categories.includes(cat)
            return (
              <Chip
                key={cat}
                selected={active}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </Chip>
            )
          })}
        </div>
      </div>

      <SwitchRow
        label={t('editor.zone.overflow')}
        description={t('editor.zone.overflowHelp')}
        checked={isOverflow}
        onCheckedChange={setIsOverflow}
      />

      <Field label={t('editor.zone.priority')} helper={t('editor.zone.priorityHelper')}>
        <Input
          type="number"
          min={1}
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value, 10) || 1)}
        />
      </Field>

      <Field label={t('editor.zone.notes')}>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </Field>

      {zone && (
        <div className="text-caption text-muted">
          {t('editor.zone.stats', {
            total: zoneSlots.length,
            free: zoneSlots.length,
            accessible: zoneSlots.filter((s) => s.properties.is_accessible).length,
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <Button variant="primary" onClick={handleSave} disabled={!code.trim() || !name.trim()}>
          {t('editor.zone.save')}
        </Button>

        {zone && (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => onDelete(zone.id)}
            className="gap-1.5"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{t('editor.zone.delete')}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

function SlotPanel({
  slots,
  onSave,
  onDelete,
}: {
  slots: any[]
  onSave: (payload: any) => void
  onDelete: (ids: string[]) => void
}) {
  const { t } = useTranslation('admin')
  const isMulti = slots.length > 1
  const first = slots[0]?.properties

  const [vehicleType, setVehicleType] = useState<VehicleType | 'keep'>(isMulti ? 'keep' : first?.vehicle_type ?? 'car')
  const [isAccessible, setIsAccessible] = useState<boolean>(first?.is_accessible ?? false)
  const [hasEvCharger, setHasEvCharger] = useState<boolean>(first?.has_ev_charger ?? false)
  const [status, setStatus] = useState<SlotStatus | 'keep'>('available')
  const [blockReason, setBlockReason] = useState<string>('')

  const handleSave = () => {
    onSave({
      ids: slots.map((s) => s.id),
      vehicleType: vehicleType !== 'keep' ? vehicleType : undefined,
      isAccessible,
      hasEvCharger,
      status: status !== 'keep' ? status : undefined,
      blockReason: status === 'blocked' ? blockReason : null,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-body font-semibold text-ink">
        {isMulti
          ? t('editor.slots.multiTitle', { count: slots.length })
          : `${t('editor.slots.title')} ${first?.label ?? ''}`}
      </h2>

      <Field label={t('editor.slots.vehicleType')}>
        <Select
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as any)}
          options={[
            ...(isMulti ? [{ value: 'keep', label: t('editor.slots.keep') }] : []),
            { value: 'car', label: 'Car' },
            { value: 'bike', label: 'Bike' },
            { value: 'ev', label: 'EV' },
            { value: 'bus', label: 'Bus' },
          ]}
        />
      </Field>

      <SwitchRow
        label={t('editor.slots.accessible')}
        checked={isAccessible}
        onCheckedChange={setIsAccessible}
      />

      <SwitchRow
        label={t('editor.slots.ev')}
        checked={hasEvCharger}
        onCheckedChange={setHasEvCharger}
      />

      <div className="flex flex-col gap-1.5">
        <Label>{t('editor.slots.status')}</Label>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          options={[
            ...(isMulti ? [{ value: 'keep', label: t('editor.slots.keep') }] : []),
            { value: 'available', label: t('editor.slots.available') },
            { value: 'blocked', label: t('editor.slots.blocked') },
          ]}
        />
      </div>

      {status === 'blocked' && (
        <Field label={t('editor.slots.blockReason')}>
          <Input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="e.g. Maintenance"
          />
        </Field>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <Button variant="primary" onClick={handleSave}>
          {t('editor.slots.save')}
        </Button>

        <Button
          variant="danger-ghost"
          size="sm"
          onClick={() => onDelete(slots.map((s) => s.id))}
          className="gap-1.5"
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>{t('editor.slots.delete')}</span>
        </Button>
      </div>
    </div>
  )
}

function GatePanel({
  gate,
  draftGate,
  onSave,
  onDelete,
}: {
  gate: any
  draftGate: any
  onSave: (g: UpsertGateInput) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('admin')
  const [name, setName] = useState(gate?.properties.name ?? draftGate?.name ?? '')
  const [nameMl, setNameMl] = useState(gate?.properties.name_ml ?? draftGate?.name_ml ?? '')
  const [kind, setKind] = useState<GateKind>(gate?.properties.kind ?? draftGate?.kind ?? 'both')

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">{t('editor.gate.title')}</h2>
        {!gate && (
          <span className="text-caption text-warning font-medium">
            {t('editor.unsavedFeature')}
          </span>
        )}
      </div>

      <Field label={t('editor.gate.name')}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main Gate"
        />
      </Field>

      <Field label={t('editor.gate.nameMl')}>
        <Input
          value={nameMl}
          onChange={(e) => setNameMl(e.target.value)}
          placeholder="e.g. പ്രധാന ഗേറ്റ്"
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label>{t('editor.gate.kind')}</Label>
        <SegmentedControl<GateKind>
          ariaLabel={t('editor.gate.kind')}
          value={kind}
          onChange={(k) => setKind(k)}
          options={[
            { value: 'entry', label: 'Entry' },
            { value: 'exit', label: 'Exit' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              id: gate?.id ?? null,
              eventId: gate?.properties.event_id ?? draftGate?.eventId ?? '',
              name: name.trim(),
              name_ml: nameMl.trim() || null,
              kind,
              point: gate?.geometry ?? draftGate?.point,
            })
          }
          disabled={!name.trim()}
        >
          {t('editor.gate.save')}
        </Button>

        {gate && (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => onDelete(gate.id)}
            className="gap-1.5"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{t('editor.gate.delete')}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

function LandmarkPanel({
  landmark,
  draftLandmark,
  onSave,
  onDelete,
}: {
  landmark: any
  draftLandmark: any
  onSave: (l: UpsertLandmarkInput) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('admin')
  const [name, setName] = useState(landmark?.properties.name ?? draftLandmark?.name ?? '')
  const [nameMl, setNameMl] = useState(landmark?.properties.name_ml ?? draftLandmark?.name_ml ?? '')
  const [kind, setKind] = useState<LandmarkKind>(landmark?.properties.kind ?? draftLandmark?.kind ?? 'venue')

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-semibold text-ink">{t('editor.landmark.title')}</h2>
        {!landmark && (
          <span className="text-caption text-warning font-medium">
            {t('editor.unsavedFeature')}
          </span>
        )}
      </div>

      <Field label={t('editor.landmark.name')}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Auditorium"
        />
      </Field>

      <Field label={t('editor.landmark.nameMl')}>
        <Input
          value={nameMl}
          onChange={(e) => setNameMl(e.target.value)}
          placeholder="e.g. ഓഡിറ്റോറിയം"
        />
      </Field>

      <Field label={t('editor.landmark.kind')}>
        <Select
          value={kind}
          onChange={(e) => setKind(e.target.value as LandmarkKind)}
          options={LANDMARK_KINDS.map((k) => ({ value: k, label: k }))}
        />
      </Field>

      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              id: landmark?.id ?? null,
              eventId: landmark?.properties.event_id ?? draftLandmark?.eventId ?? '',
              name: name.trim(),
              name_ml: nameMl.trim() || null,
              kind,
              point: landmark?.geometry ?? draftLandmark?.point,
            })
          }
          disabled={!name.trim()}
        >
          {t('editor.landmark.save')}
        </Button>

        {landmark && (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => onDelete(landmark.id)}
            className="gap-1.5"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{t('editor.landmark.delete')}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

function OverlayPanel({
  overlay,
  draftOverlay,
  onSave,
  onDelete,
}: {
  overlay?: OverlayRow | null
  draftOverlay?: Partial<OverlayRow> | null
  onSave: (o: any) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation('admin')
  const [opacity, setOpacity] = useState(overlay?.opacity ?? draftOverlay?.opacity ?? 0.85)
  const [isVisible, setIsVisible] = useState(overlay?.is_visible ?? draftOverlay?.is_visible ?? true)
  const [imageUrl, setImageUrl] = useState(overlay?.url ?? draftOverlay?.url ?? '')

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setImageUrl(ev.target.result)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-body font-semibold text-ink">{t('editor.overlay.title')}</h2>

      <div className="flex flex-col gap-2">
        <Label>{t('editor.overlay.upload')}</Label>
        <Input type="file" accept="image/*" onChange={handleFileUpload} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-body-sm">
          <Label>{t('editor.overlay.opacity')}</Label>
          <span className="text-caption text-muted">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <SwitchRow
        label={t('editor.overlay.visible')}
        checked={isVisible}
        onCheckedChange={setIsVisible}
      />

      <div className="rounded bg-surface-2 p-3 text-caption text-muted">
        {t('editor.overlay.place')}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-line">
        <Button
          variant="primary"
          onClick={() =>
            onSave({
              id: overlay?.id,
              url: imageUrl,
              opacity,
              is_visible: isVisible,
            })
          }
          disabled={!imageUrl}
        >
          {t('editor.overlay.save')}
        </Button>

        {overlay && (
          <Button
            variant="danger-ghost"
            size="sm"
            onClick={() => onDelete(overlay.id)}
            className="gap-1.5"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{t('editor.overlay.remove')}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
