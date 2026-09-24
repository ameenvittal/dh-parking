import type { PaddingOptions } from 'maplibre-gl'
import { MapControls } from '@/features/map/MapControls'
import { useMapContext } from '@/features/map/mapContext'
import type { Bbox } from '@/features/map/style/layers'

type FitControlsProps = {
  box: Bbox | null
  padding: number | PaddingOptions
  className?: string
}

/** Map controls whose recenter button fits the camera back to `box`. */
export function FitControls({ box, padding, className }: FitControlsProps) {
  const { map } = useMapContext()
  return (
    <MapControls
      className={className}
      onRecenter={
        box
          ? () =>
              map?.fitBounds(
                [
                  [box[0], box[1]],
                  [box[2], box[3]],
                ],
                { padding, maxZoom: 19, duration: 400 },
              )
          : undefined
      }
    />
  )
}
