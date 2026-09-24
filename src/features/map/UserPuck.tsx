import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapMarker } from './MapMarker'
import { useMapContext } from './mapContext'

export type PuckFix = { lng: number; lat: number; accuracy: number; heading: number | null }

type UserPuckProps = { fix: PuckFix | null }

function metresPerPixel(lat: number, zoom: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)
}

/** Accuracy circle, 16 px dot with a white ring, and a 60 degree heading cone when the heading is known. */
export function UserPuck({ fix }: UserPuckProps) {
  const { t } = useTranslation('map')
  const { map } = useMapContext()
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 17)

  useEffect(() => {
    if (!map) return
    const onZoom = () => setZoom(map.getZoom())
    onZoom()
    map.on('zoom', onZoom)
    return () => {
      map.off('zoom', onZoom)
    }
  }, [map])

  if (!fix) return null
  const accuracyPx = Math.min(600, Math.max(0, (fix.accuracy * 2) / metresPerPixel(fix.lat, zoom)))
  const box = Math.max(64, accuracyPx)
  const hasHeading = fix.heading !== null && Number.isFinite(fix.heading)

  return (
    <MapMarker lngLat={[fix.lng, fix.lat]} rotation={hasHeading ? (fix.heading ?? 0) : 0} className="pointer-events-none z-20">
      <div
        role="img"
        aria-label={t('map.you')}
        className="relative flex items-center justify-center"
        style={{ width: box, height: box }}
      >
        <span
          aria-hidden="true"
          className="absolute rounded-full bg-primary/12"
          style={{ width: accuracyPx, height: accuracyPx }}
        />
        {hasHeading ? (
          <svg aria-hidden="true" viewBox="0 0 64 64" className="absolute size-16 text-primary">
            {/* 60 degree wedge pointing up (north), rotated with the marker */}
            <path d="M32 32 L15.9 4.1 A32 32 0 0 1 48.1 4.1 Z" fill="currentColor" opacity="0.28" />
          </svg>
        ) : null}
        <span aria-hidden="true" className="relative size-4 rounded-full border-3 border-surface bg-primary shadow-raised" />
      </div>
    </MapMarker>
  )
}
