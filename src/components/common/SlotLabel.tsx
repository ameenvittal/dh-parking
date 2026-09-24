import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { AccessibleIcon, EvChargerIcon, zoneBgClass } from './statusMeta'

type SlotLabelProps = {
  label: string
  /** Zone colour key, `zone-1` to `zone-8`. */
  zoneColor?: string | null
  zoneName?: string | null
  accessible?: boolean
  ev?: boolean
  size?: 'sm' | 'md' | 'xl'
  className?: string
}

const sizes = {
  sm: { text: 'text-h3 font-bold', bar: 'w-1.5 self-stretch', icon: 16 },
  md: { text: 'text-h1', bar: 'w-1.5 self-stretch', icon: 20 },
  xl: { text: 'text-display', bar: 'w-1.5 self-stretch', icon: 24 },
} as const

/** Painted-bay style slot label (docs 06 section 6). */
export function SlotLabel({ label, zoneColor, zoneName, accessible, ev, size = 'md', className }: SlotLabelProps) {
  const { t } = useTranslation('common')
  const s = sizes[size]
  return (
    <div className={cn('inline-flex min-w-0 items-stretch gap-2.5', className)}>
      <span aria-hidden="true" className={cn('shrink-0 rounded-xs', s.bar, zoneBgClass(zoneColor))} />
      <span className="flex min-w-0 flex-col justify-center">
        <span className="flex items-center gap-1.5">
          <span className={cn('font-display leading-none tracking-wide text-ink tabular-nums', s.text)}>{label}</span>
          {accessible ? (
            <AccessibleIcon size={s.icon} strokeWidth={1.75} className="text-primary" aria-label={t('accessible')} role="img" />
          ) : null}
          {ev ? <EvChargerIcon size={s.icon} strokeWidth={1.75} className="text-primary" aria-label={t('evCharger')} role="img" /> : null}
        </span>
        {size !== 'sm' && zoneName ? <span className="mt-1 truncate text-body-sm text-muted">{zoneName}</span> : null}
      </span>
    </div>
  )
}
