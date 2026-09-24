import { useEffect } from 'react'
import { mapColors } from './style/colors'
import { useMapContext } from './mapContext'
import { SOURCE, addLayerOrdered, removeLayers, removeSource, setGeoJson } from './style/layers'

type RouteLayerProps = {
  /** On-road part of the route. */
  line: GeoJSON.Feature<GeoJSON.LineString> | null
  /** First and last legs, or a straight fallback line: drawn dashed. */
  legs?: (GeoJSON.Feature<GeoJSON.LineString> | null)[]
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const ROUTE_LAYERS = ['route-casing', 'route-line', 'route-leg'] as const

/** Route line (7 px on an 11 px white casing) and dashed legs (docs 06 section 7). */
export function RouteLayer({ line, legs = [] }: RouteLayerProps) {
  const { map, styleVersion } = useMapContext()

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SOURCE.route, EMPTY)
    setGeoJson(map, SOURCE.routeLegs, EMPTY)
    addLayerOrdered(map, {
      id: 'route-casing',
      type: 'line',
      source: SOURCE.route,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': mapColors.white, 'line-width': 11 },
    })
    addLayerOrdered(map, {
      id: 'route-line',
      type: 'line',
      source: SOURCE.route,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': mapColors.mapRoute, 'line-width': 7 },
    })
    addLayerOrdered(map, {
      id: 'route-leg',
      type: 'line',
      source: SOURCE.routeLegs,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': mapColors.mapRoute, 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
    })
    return () => {
      if (!map.getStyle()) return
      removeLayers(map, ROUTE_LAYERS)
      removeSource(map, SOURCE.route)
      removeSource(map, SOURCE.routeLegs)
    }
  }, [map, styleVersion])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SOURCE.route, line ? { type: 'FeatureCollection', features: [line] } : EMPTY)
    const legFeatures = legs.filter((l): l is GeoJSON.Feature<GeoJSON.LineString> => Boolean(l))
    setGeoJson(map, SOURCE.routeLegs, { type: 'FeatureCollection', features: legFeatures })
  }, [map, styleVersion, line, legs])

  return null
}
