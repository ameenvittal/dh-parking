import { useState, type KeyboardEvent } from 'react'
import {
  ChevronDown,
  Info,
  Layers,
  MapPin,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { BaseMapKind } from '@/types/domain'
import { satelliteAvailable } from '@/features/map/style/layers'
import type { ConnectivityWarning } from '@/lib/geo/roadGraph'
import { useEditorStore } from './store'

type EditorTopBarProps = {
  isLive: boolean
  venueName?: string | null
  warnings: ConnectivityWarning[]
  onSaveRoads: () => void
  isSavingRoads: boolean
  onFlyToDarulHuda: () => void
  onSetCenterHere: () => void
  onSearchPlace: (query: string) => void
  isSearchingPlace: boolean
}

export function EditorTopBar({
  isLive,
  venueName,
  warnings,
  onSaveRoads,
  isSavingRoads,
  onFlyToDarulHuda,
  onSetCenterHere,
  onSearchPlace,
  isSearchingPlace,
}: EditorTopBarProps) {
  const { t } = useTranslation(['admin', 'common'])
  const {
    baseLayer,
    setBaseLayer,
    layers,
    setLayers,
    roadsDirty,
    savedAt,
  } = useEditorStore()

  const [searchQuery, setSearchQuery] = useState('')
  const hasSatellite = satelliteAvailable()

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault()
      onSearchPlace(searchQuery.trim())
    }
  }

  return (
    <div className="flex flex-col border-b border-line bg-surface">
      {isLive && (
        <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-body-sm text-warning font-medium">
          <Info size={16} aria-hidden="true" />
          <span>{t('editor.liveInfo')}</span>
        </div>
      )}

      <div className="flex h-14 items-center justify-between gap-3 px-4">
        {/* Left: Title & Base Map */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-body font-semibold text-ink">{t('editor.title')}</h1>
            {venueName && (
              <span className="hidden max-w-56 truncate text-caption text-muted lg:inline" title={venueName}>
                • {venueName}
              </span>
            )}
          </div>

          {hasSatellite && (
            <div className="w-44">
              <SegmentedControl<BaseMapKind>
                ariaLabel={t('editor.baseMap')}
                value={baseLayer}
                onChange={(val) => setBaseLayer(val)}
                options={[
                  { value: 'street', label: t('editor.street') },
                  { value: 'satellite', label: t('editor.satellite') },
                ]}
              />
            </div>
          )}
        </div>

        {/* Center: Location Search & Darul Huda Preset */}
        <div className="hidden items-center gap-2 xl:flex">
          {/* Quick preset for Darul Huda */}
          <Button
            variant="secondary"
            size="sm"
            onClick={onFlyToDarulHuda}
            className="gap-1.5 text-caption font-medium"
            title="Jump to Darul Huda Islamic University campus"
          >
            <MapPin size={14} className="text-primary" aria-hidden="true" />
            <span>Darul Huda</span>
          </Button>

          {/* Place Search */}
          <div className="relative w-52">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search location..."
              className="h-8 pl-8 pr-2 text-caption"
            />
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (searchQuery.trim()) onSearchPlace(searchQuery.trim())
            }}
            loading={isSearchingPlace}
            disabled={!searchQuery.trim()}
            className="h-8 px-2 text-caption"
          >
            Go
          </Button>

          {/* Set Center to Current View */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSetCenterHere}
            className="h-8 px-2.5 text-caption text-muted hover:text-ink"
            title="Save current map center as event venue location"
          >
            Set center here
          </Button>
        </div>

        {/* Right: Layers, Warnings, Roads save & Saved status */}
        <div className="flex items-center gap-2">
          {/* Layers Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Layers size={16} aria-hidden="true" />
                <span>{t('editor.layers')}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2">
              <DropdownMenuLabel>{t('editor.layers')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex flex-col gap-2 py-1">
                {(
                  [
                    ['zones', t('editor.layer.zones')],
                    ['slots', t('editor.layer.slots')],
                    ['roads', t('editor.layer.roads')],
                    ['gates', t('editor.layer.gates')],
                    ['landmarks', t('editor.layer.landmarks')],
                    ['overlay', t('editor.layer.overlay')],
                    ['labels', t('editor.layer.labels')],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1 text-body-sm text-ink hover:bg-surface-2"
                  >
                    <Checkbox
                      checked={layers[key]}
                      onCheckedChange={(checked) => setLayers({ [key]: Boolean(checked) })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Warnings Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={warnings.length > 0 ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
              >
                <TriangleAlert
                  size={16}
                  className={warnings.length > 0 ? 'text-warning' : 'text-muted'}
                  aria-hidden="true"
                />
                <span>
                  {warnings.length > 0
                    ? t('editor.warnings', { count: warnings.length })
                    : t('editor.noWarnings')}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>
                {warnings.length > 0
                  ? t('editor.warnings', { count: warnings.length })
                  : t('editor.noWarnings')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {warnings.length === 0 ? (
                <div className="p-3 text-body-sm text-muted">{t('editor.noWarnings')}</div>
              ) : (
                warnings.map((w, idx) => (
                  <DropdownMenuItem
                    key={`${w.kind}-${w.id}-${idx}`}
                    className="flex flex-col items-start gap-0.5 text-body-sm"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-ink">
                      <TriangleAlert size={14} className="text-warning shrink-0" />
                      <span>{t('editor.validation.notConnected', { name: w.name })}</span>
                    </div>
                    {w.distanceM !== null && (
                      <span className="text-caption text-muted pl-5">
                        {Math.round(w.distanceM)} m away from road
                      </span>
                    )}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save roads button */}
          <Button
            variant="primary"
            size="sm"
            disabled={!roadsDirty || isSavingRoads}
            onClick={onSaveRoads}
          >
            {t('editor.saveRoads')}
          </Button>

          {/* Saved indicator */}
          <div className="hidden pl-2 text-caption text-muted md:block">
            {savedAt ? t('editor.savedAt', { time: savedAt }) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
