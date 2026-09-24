export const APP_NAME = 'EventPark'
export const APP_TIMEZONE = 'Asia/Kolkata'

/** Demo mode: the backend is simulated in the browser. See docs/01-PRD.md decision 16. */
export const DEMO_MODE = true

export const APP_URL: string = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

export const STREET_STYLE_URL: string =
  import.meta.env.VITE_MAP_STREET_STYLE || 'https://tiles.openfreemap.org/styles/liberty'

export const MAPTILER_KEY: string | undefined = import.meta.env.VITE_MAPTILER_KEY || undefined

export const DEFAULTS = {
  gateStorageKey: 'eventpark.gate',
  langStorageKey: 'eventpark.lang',
  driverSessionHours: 6,
} as const
