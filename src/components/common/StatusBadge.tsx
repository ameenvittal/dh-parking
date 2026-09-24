import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { SlotStatus, VehicleType, VisitStatus } from '@/types/domain'
import { slotStatusMeta, vehicleTypeIcon, visitStatusMeta } from './statusMeta'

type StatusBadgeProps = {
  status: VisitStatus | SlotStatus
  /** For `occupied` slots: icon follows the vehicle type. */
  vehicleType?: VehicleType
  className?: string
}

const SLOT_ONLY = new Set<string>(['available', 'occupied', 'blocked'])

function isSlotStatus(s: VisitStatus | SlotStatus): s is SlotStatus {
  return SLOT_ONLY.has(s)
}

/** 24 px, soft background, status text colour, 14 px icon, caption text (docs 06 section 6). */
export function StatusBadge({ status, vehicleType, className }: StatusBadgeProps) {
  const { t } = useTranslation('common')
  const slot = isSlotStatus(status)
  const meta = slot ? slotStatusMeta[status] : visitStatusMeta[status]
  const Icon = slot && status === 'occupied' && vehicleType ? vehicleTypeIcon[vehicleType] : meta.icon
  const label = slot ? t(`enums.slotStatus.${status}`) : t(`enums.visitStatus.${status}`)
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-semibold whitespace-nowrap',
        meta.soft,
        meta.text,
        className,
      )}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </span>
  )
}
