import type { MapLayerMouseEvent } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { useMapContext } from '@/features/map/mapContext'
import { mapColors, visitStatusColors } from '@/features/map/style/colors'
import { SOURCE, addLayerOrdered, removeLayers, removeSource, setGeoJson } from '@/features/map/style/layers'
import type { LiveVehicleView } from './useLiveVehicles'

type VehiclesLayerProps = {
  vehicles: LiveVehicleView[]
  onVehicleClick?: (visitId: string, lngLat: [number, number]) => void
}

/** Admin vehicles: 7 px circles in status colour with a 2 px white stroke, faded when stale (docs/06 section 7). */
export function VehiclesLayer({ vehicles, onVehicleClick }: VehiclesLayerProps) {
  const { map, styleVersion } = useMapContext()
  const clickRef = useRef(onVehicleClick)
  useEffect(() => {
    clickRef.current = onVehicleClick
  })

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SOURCE.vehicles, { type: 'FeatureCollection', features: [] })
    addLayerOrdered(map, {
      id: 'vehicles',
      type: 'circle',
      source: SOURCE.vehicles,
      paint: {
        'circle-radius': 7,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': mapColors.white,
        'circle-stroke-width': 2,
        'circle-opacity': ['case', ['get', 'faded'], 0.4, 1],
        'circle-stroke-opacity': ['case', ['get', 'faded'], 0.4, 1],
      },
    })
    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      const id = f?.properties?.visit_id
      if (typeof id === 'string') clickRef.current?.(id, [e.lngLat.lng, e.lngLat.lat])
    }
    const enter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }
    const leave = () => {
      map.getCanvas().style.cursor = ''
    }
    map.on('click', 'vehicles', onClick)
    map.on('mouseenter', 'vehicles', enter)
    map.on('mouseleave', 'vehicles', leave)
    return () => {
      map.off('click', 'vehicles', onClick)
      map.off('mouseenter', 'vehicles', enter)
      map.off('mouseleave', 'vehicles', leave)
      if (!map.getStyle()) return
      removeLayers(map, ['vehicles'])
      removeSource(map, SOURCE.vehicles)
    }
  }, [map, styleVersion])

  useEffect(() => {
    if (!map || styleVersion === 0) return
    setGeoJson(map, SOURCE.vehicles, {
      type: 'FeatureCollection',
      features: vehicles.map((v) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lng, v.lat] },
        properties: { visit_id: v.visit_id, color: visitStatusColors[v.status], faded: v.faded },
      })),
    })
  }, [map, styleVersion, vehicles])

  return null
}
