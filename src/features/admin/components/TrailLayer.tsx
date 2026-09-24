import { useEffect } from 'react'
import { useMapContext } from '@/features/map/mapContext'
import { mapColors } from '@/features/map/style/colors'
import { removeLayers, removeSource, setGeoJson } from '@/features/map/style/layers'
import type { LngLat } from '@/types/domain'

const SRC = 'admin-trail'
const LAYER = 'admin-trail-line'

/** Position trail of one visit (last 200 positions), drawn under the vehicles. */
export function TrailLayer({ trail }: { trail: LngLat[] | null }) {
  const { map, styleVersion } = useMapContext()

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SRC, { type: 'FeatureCollection', features: [] })
    if (!map.getLayer(LAYER)) {
      map.addLayer(
        {
          id: LAYER,
          type: 'line',
          source: SRC,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': mapColors.statusEnroute, 'line-width': 3, 'line-dasharray': [2, 1.5] },
        },
        map.getLayer('vehicles') ? 'vehicles' : map.getLayer('gates') ? 'gates' : undefined,
      )
    }
    return () => {
      if (!map.getStyle()) return
      removeLayers(map, [LAYER])
      removeSource(map, SRC)
    }
  }, [map, styleVersion])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SRC, {
      type: 'FeatureCollection',
      features:
        trail && trail.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: trail }, properties: {} }] : [],
    })
  }, [map, styleVersion, trail])

  return null
}
