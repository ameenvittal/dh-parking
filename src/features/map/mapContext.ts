import { createContext, useContext } from 'react'
import type { Map as MlMap } from 'maplibre-gl'

export type MapLib = typeof import('maplibre-gl')

export type MapContextValue = {
  map: MlMap | null
  lib: MapLib | null
  /** Increments on every `style.load` so layer components can re-add their sources. */
  styleVersion: number
  zoom: number
}

export const MapContext = createContext<MapContextValue>({ map: null, lib: null, styleVersion: 0, zoom: 0 })

export function useMapContext(): MapContextValue {
  return useContext(MapContext)
}
