import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { SlotStatus, VehicleType, VisitStatus, VisitorCategory } from '@/types/domain'
import { PlateChip } from './PlateChip'
import { StatusBadge } from './StatusBadge'
import { vehicleTypeIcon } from './statusMeta'

type VehicleCardProps = {
  plate: string
  status?: VisitStatus | SlotStatus
  vehicleType?: VehicleType
  color?: string | null
  make?: string | null
  category?: VisitorCategory
  slotLabel?: string | null
  /** Relative time line, for example "Assigned 6 min ago". */
  time?: ReactNode
  /** Extra badges next to the status (open alerts). */
  badges?: ReactNode
  /** Buttons row at the bottom. Only where the page spec asks for actions. */
  actions?: ReactNode
  /** Top-right overflow menu, next to the status badge. */
  menu?: ReactNode
  plateSize?: 'sm' | 'md'
  onClick?: () => void
  className?: string
}

/** Vehicle card for zone and gate lists (docs 06 section 6). No shadow in lists. */
export function VehicleCard({
  plate,
  status,
  vehicleType,
  color,
  make,
  category,
  slotLabel,
  time,
  badges,
  actions,
  menu,
  plateSize = 'md',
  onClick,
  className,
}: VehicleCardProps) {
  const { t } = useTranslation('common')
  const TypeIcon = vehicleType ? vehicleTypeIcon[vehicleType] : null
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <PlateChip plate={plate} size={plateSize} />
        <div className={cn('flex shrink-0 flex-wrap items-center justify-end gap-1.5', menu ? 'mr-10' : undefined)}>
          {badges}
          {status ? <StatusBadge status={status} vehicleType={vehicleType} /> : null}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted">
          {vehicleType && TypeIcon ? (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <TypeIcon size={16} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
              {t(`enums.vehicleType.${vehicleType}`)}
            </span>
          ) : null}
          {color ? <span className="capitalize">{color}</span> : null}
          {make ? <span>{make}</span> : null}
        </div>
        {slotLabel ? (
          <span className="shrink-0 font-display text-h3 font-bold text-ink tabular-nums">{t('slotLabel', { label: slotLabel })}</span>
        ) : null}
      </div>
      {category || time ? (
        <div className="mt-1 flex items-center justify-between gap-3 text-body-sm text-muted">
          {category ? <span>{t(`enums.category.${category}`)}</span> : <span />}
          {time ? <span className="text-right">{time}</span> : null}
        </div>
      ) : null}
    </>
  )

  return (
    <article className={cn('relative rounded-lg border border-line bg-surface', className)}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="block w-full rounded-lg p-4 text-left outline-none active:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
        >
          {body}
        </button>
      ) : (
        <div className="p-4">{body}</div>
      )}
      {menu ? <div className="absolute top-2.5 right-2.5">{menu}</div> : null}
      {actions ? <div className="flex gap-2 px-4 pb-4 [&>*]:flex-1">{actions}</div> : null}
    </article>
  )
}
