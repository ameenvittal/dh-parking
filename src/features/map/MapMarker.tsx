import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { LngLat } from '@/types/domain'
import { useMapContext } from './mapContext'

type MapMarkerProps = {
  lngLat: LngLat
  children: ReactNode
  anchor?: 'center' | 'bottom' | 'top'
  /** Degrees clockwise from north, rotating with the map. */
  rotation?: number
  className?: string
}

/** HTML marker rendered through a React portal. Used for the few gates, landmarks, zone labels and the user puck. */
export function MapMarker({ lngLat, children, anchor = 'center', rotation, className }: MapMarkerProps) {
  const { map, lib } = useMapContext()
  const [el] = useState(() => document.createElement('div'))
  const marker = useMemo(
    () => (lib ? new lib.Marker({ element: el, anchor, rotationAlignment: 'map', pitchAlignment: 'map' }) : null),
    [lib, el, anchor],
  )
  const [lng, lat] = lngLat

  useEffect(() => {
    if (!map || !marker) return
    marker.setLngLat([lng, lat]).addTo(map)
    return () => {
      marker.remove()
    }
    // position changes are applied below without re-adding the marker
  }, [map, marker]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    marker?.setLngLat([lng, lat])
  }, [marker, lng, lat])

  useEffect(() => {
    if (rotation !== undefined) marker?.setRotation(rotation)
  }, [marker, rotation])

  return map && marker ? createPortal(<div className={className}>{children}</div>, el) : null
}
