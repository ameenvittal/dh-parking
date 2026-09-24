import { useEffect } from 'react'
import { useMapContext } from '@/features/map/mapContext'
import { mapColors } from '@/features/map/style/colors'
import { removeLayers, removeSource, setGeoJson } from '@/features/map/style/layers'
import type { RoadNetwork } from '@/types/domain'
import { trafficLevel } from './traffic'

const SRC = 'admin-traffic'
const LAYER = 'admin-traffic'

/** Road congestion colouring over the road lines (docs/05 section 9). Light roads are not overdrawn. */
export function TrafficLayer({ roads, counts, visible }: { roads: RoadNetwork; counts: Map<string, number>; visible: boolean }) {
  const { map, styleVersion } = useMapContext()

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SRC, { type: 'FeatureCollection', features: [] })
    if (!map.getLayer(LAYER)) {
      const before = ['roads-oneway-arrows', 'slots-fill'].find((id) => map.getLayer(id))
      map.addLayer(
        {
          id: LAYER,
          type: 'line',
          source: SRC,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-width': 6,
            'line-color': ['match', ['get', 'level'], 'high', mapColors.trafficHigh, mapColors.trafficMedium],
          },
        },
        before,
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
    const features = visible
      ? roads.segments
          .map((s) => ({ s, level: trafficLevel(counts.get(s.id) ?? 0) }))
          .filter((x) => x.level !== 'light')
          .map(({ s, level }) => ({
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: s.coords },
            properties: { level },
          }))
      : []
    setGeoJson(map, SRC, { type: 'FeatureCollection', features })
  }, [map, styleVersion, roads, counts, visible])

  return null
}
