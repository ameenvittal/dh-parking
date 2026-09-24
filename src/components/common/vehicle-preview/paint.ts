export type VehicleColorKey =
  | 'white'
  | 'silver'
  | 'grey'
  | 'black'
  | 'red'
  | 'blue'
  | 'brown'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'unknown'

const FALLBACK_COLORS: Record<VehicleColorKey, string> = {
  white: '#F5F6F8',
  silver: '#C0C4CC',
  grey: '#606875',
  black: '#20232A',
  red: '#D32F2F',
  blue: '#1976D2',
  brown: '#6D4C41',
  green: '#388E3C',
  yellow: '#FBC02D',
  orange: '#F57C00',
  unknown: '#C0C4CC',
}

export function normalizeColorKey(colorName?: string | null): VehicleColorKey {
  if (!colorName) return 'unknown'
  const key = colorName.toLowerCase().trim() as VehicleColorKey
  if (key in FALLBACK_COLORS) {
    return key
  }
  return 'unknown'
}

export function paintFor(colorName?: string | null): string {
  const key = normalizeColorKey(colorName)
  const cssKey = key === 'unknown' ? 'silver' : key

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computed = getComputedStyle(document.documentElement).getPropertyValue(`--color-paint-${cssKey}`).trim()
    if (computed) {
      return computed
    }
  }

  return FALLBACK_COLORS[key] || FALLBACK_COLORS.silver
}
