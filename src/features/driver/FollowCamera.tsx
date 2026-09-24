import { useEffect } from 'react'
import { useMapContext } from '@/features/map/mapContext'
import type { LocationFix } from './useLiveLocation'

type FollowCameraProps = {
  fix: LocationFix | null
  enabled: boolean
  zoom?: number
}

/** Follow mode: keeps the puck at 65% of the map height, zoom 18, north up (docs/05 section 8.3). */
export function FollowCamera({ fix, enabled, zoom = 18 }: FollowCameraProps) {
  const { map, styleVersion } = useMapContext()
  const lng = fix?.lng
  const lat = fix?.lat
  useEffect(() => {
    if (!map || styleVersion === 0 || !enabled || lng === undefined || lat === undefined) return
    const h = map.getContainer().clientHeight
    map.easeTo({
      center: [lng, lat],
      zoom,
      bearing: 0,
      padding: { top: Math.round(h * 0.3), bottom: 0, left: 0, right: 0 },
      duration: 800,
    })
  }, [map, styleVersion, enabled, lng, lat, zoom])
  return null
}
