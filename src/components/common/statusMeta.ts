import {
  Accessibility,
  Ban,
  Bike,
  Bookmark,
  Bus,
  Car,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  LogOut,
  Navigation,
  PlugZap,
  Siren,
  Square,
  TriangleAlert,
  Truck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { AlertType, SlotStatus, VehicleType, VisitStatus } from '@/types/domain'

/** docs 06 section 4. Static class strings so Tailwind picks them up. */
export type StatusTone = { icon: LucideIcon; text: string; soft: string; solid: string }

export const visitStatusMeta: Record<VisitStatus, StatusTone> = {
  assigned: { icon: Bookmark, text: 'text-status-assigned', soft: 'bg-status-assigned-soft', solid: 'bg-status-assigned' },
  en_route: { icon: Navigation, text: 'text-status-enroute', soft: 'bg-status-enroute-soft', solid: 'bg-status-enroute' },
  driver_parked: { icon: Hourglass, text: 'text-warning', soft: 'bg-status-waiting-soft', solid: 'bg-status-waiting' },
  confirmed: { icon: CircleCheck, text: 'text-status-occupied', soft: 'bg-status-occupied-soft', solid: 'bg-status-occupied' },
  exited: { icon: LogOut, text: 'text-muted', soft: 'bg-status-blocked-soft', solid: 'bg-status-exited' },
  cancelled: { icon: CircleX, text: 'text-muted', soft: 'bg-status-blocked-soft', solid: 'bg-status-exited' },
}

export const slotStatusMeta: Record<SlotStatus, StatusTone> = {
  available: { icon: Square, text: 'text-status-available', soft: 'bg-status-available-soft', solid: 'bg-status-available' },
  assigned: { icon: Bookmark, text: 'text-status-assigned', soft: 'bg-status-assigned-soft', solid: 'bg-status-assigned' },
  occupied: { icon: Car, text: 'text-status-occupied', soft: 'bg-status-occupied-soft', solid: 'bg-status-occupied' },
  blocked: { icon: Ban, text: 'text-muted', soft: 'bg-status-blocked-soft', solid: 'bg-status-blocked' },
}

export const vehicleTypeIcon: Record<VehicleType, LucideIcon> = {
  bike: Bike,
  car: Car,
  ev: Zap,
  bus: Bus,
  other: Truck,
}

export const AccessibleIcon = Accessibility
export const EvChargerIcon = PlugZap

export type AlertTone = 'danger' | 'warning' | 'neutral'

export const alertTypeMeta: Record<AlertType, { icon: LucideIcon; tone: AlertTone; text: string; soft: string }> = {
  sos: { icon: Siren, tone: 'danger', text: 'text-danger', soft: 'bg-danger-soft' },
  wrong_slot: { icon: TriangleAlert, tone: 'warning', text: 'text-warning', soft: 'bg-warning-soft' },
  wrong_parking: { icon: TriangleAlert, tone: 'warning', text: 'text-warning', soft: 'bg-warning-soft' },
  location_mismatch: { icon: TriangleAlert, tone: 'warning', text: 'text-warning', soft: 'bg-warning-soft' },
  not_arrived: { icon: Clock, tone: 'neutral', text: 'text-muted', soft: 'bg-surface-2' },
  confirm_pending: { icon: Clock, tone: 'neutral', text: 'text-muted', soft: 'bg-surface-2' },
  overstay: { icon: Clock, tone: 'neutral', text: 'text-muted', soft: 'bg-surface-2' },
}

/** Zone colour key (`zone-1` to `zone-8`) to a background utility. */
const ZONE_BG: Record<string, string> = {
  'zone-1': 'bg-zone-1',
  'zone-2': 'bg-zone-2',
  'zone-3': 'bg-zone-3',
  'zone-4': 'bg-zone-4',
  'zone-5': 'bg-zone-5',
  'zone-6': 'bg-zone-6',
  'zone-7': 'bg-zone-7',
  'zone-8': 'bg-zone-8',
}

export const ZONE_COLOR_KEYS = Object.keys(ZONE_BG)

export function zoneBgClass(color: string | null | undefined): string {
  return (color && ZONE_BG[color]) || 'bg-zone-1'
}
