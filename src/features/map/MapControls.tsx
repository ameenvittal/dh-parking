import { useTranslation } from 'react-i18next'
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BaseMapKind } from '@/types/domain'
import { cn } from '@/lib/utils'
import { useMapContext } from './mapContext'
import { satelliteAvailable } from './style/layers'

type MapControlsProps = {
  onRecenter?: () => void
  /** Recenter button shown in the active colour (follow mode on). */
  recenterActive?: boolean
  baseLayer?: BaseMapKind
  onBaseLayerChange?: (kind: BaseMapKind) => void
  showZoom?: boolean
  className?: string
}

function ControlButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex size-11 items-center justify-center text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
        active && 'text-primary',
      )}
    >
      {children}
    </button>
  )
}

/** Floating control stack (docs 06 section 6): zoom in, zoom out, recenter, layers. */
export function MapControls({
  onRecenter,
  recenterActive = false,
  baseLayer,
  onBaseLayerChange,
  showZoom = true,
  className,
}: MapControlsProps) {
  const { t } = useTranslation('map')
  const { map } = useMapContext()
  const canSwitch = Boolean(baseLayer && onBaseLayerChange && satelliteAvailable())
  const groupClass = 'flex flex-col divide-y divide-line overflow-hidden rounded-lg bg-surface shadow-overlay'

  return (
    <div className={cn('pointer-events-none absolute right-3 z-10 flex flex-col gap-2', className ?? 'top-3')}>
      {showZoom ? (
        <div className={cn(groupClass, 'pointer-events-auto')}>
          <ControlButton label={t('map.controls.zoomIn')} onClick={() => map?.zoomIn()}>
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          </ControlButton>
          <ControlButton label={t('map.controls.zoomOut')} onClick={() => map?.zoomOut()}>
            <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
          </ControlButton>
        </div>
      ) : null}
      {onRecenter || canSwitch ? (
        <div className={cn(groupClass, 'pointer-events-auto')}>
          {onRecenter ? (
            <ControlButton label={t('map.controls.recenter')} onClick={onRecenter} active={recenterActive}>
              <LocateFixed size={20} strokeWidth={1.75} aria-hidden="true" />
            </ControlButton>
          ) : null}
          {canSwitch && baseLayer && onBaseLayerChange ? (
            <ControlButton
              label={baseLayer === 'satellite' ? t('map.controls.showStreet') : t('map.controls.showSatellite')}
              onClick={() => onBaseLayerChange(baseLayer === 'satellite' ? 'street' : 'satellite')}
              active={baseLayer === 'satellite'}
            >
              <Layers size={20} strokeWidth={1.75} aria-hidden="true" />
            </ControlButton>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
