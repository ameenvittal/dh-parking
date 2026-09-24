/**
 * Design tokens for map code (docs/06-DESIGN-SYSTEM.md section 2), same values as
 * src/styles/theme.css in camelCase. This file and theme.css are the only places
 * allowed to contain raw colour values.
 */
import type { SlotStatus, VisitStatus } from '@/types/domain'

export const mapColors = {
  canvas: '#F4F6F9',
  surface: '#FFFFFF',
  surface2: '#EEF1F5',
  line: '#E1E5EB',
  lineStrong: '#C9CFD8',
  ink: '#162033',
  muted: '#5A6475',
  subtle: '#8A93A3',
  primary: '#1F4FD6',
  danger: '#D63B3B',
  warning: '#B7791F',
  success: '#1E8E52',
  statusAvailable: '#1E9E5A',
  statusAssigned: '#0E9FB8',
  statusEnroute: '#7A4FE0',
  statusWaiting: '#E3A008',
  statusOccupied: '#4B5566',
  statusBlocked: '#A3ABB8',
  statusExited: '#A3ABB8',
  statusOccupiedSoft: '#E9EBEF',
  statusBlockedSoft: '#EEF0F3',
  mapRoad: '#7C8698',
  mapRoute: '#1F4FD6',
  trafficMedium: '#E3A008',
  trafficHigh: '#D63B3B',
  white: '#FFFFFF',
} as const

export const zoneColors: Record<string, string> = {
  'zone-1': '#3B6FE0',
  'zone-2': '#E07B39',
  'zone-3': '#C2477F',
  'zone-4': '#2A9D8F',
  'zone-5': '#B08900',
  'zone-6': '#6D5BD0',
  'zone-7': '#4C8C2B',
  'zone-8': '#D1495B',
}

export function zoneColor(token: string | null | undefined): string {
  return (token && zoneColors[token]) || zoneColors['zone-1']
}

export const slotStatusColors: Record<SlotStatus, string> = {
  available: mapColors.statusAvailable,
  assigned: mapColors.statusAssigned,
  occupied: mapColors.statusOccupied,
  blocked: mapColors.statusBlocked,
}

export const visitStatusColors: Record<VisitStatus, string> = {
  assigned: mapColors.statusEnroute,
  en_route: mapColors.statusEnroute,
  driver_parked: mapColors.statusWaiting,
  confirmed: mapColors.statusOccupied,
  exited: mapColors.statusExited,
  cancelled: mapColors.statusExited,
}
