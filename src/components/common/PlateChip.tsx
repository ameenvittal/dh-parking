import { useTranslation } from 'react-i18next'
import { formatPlate } from '@/lib/format'
import { cn } from '@/lib/utils'

type PlateChipProps = {
  plate: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { box: 'h-7', text: 'px-2 font-display text-body font-bold tracking-wide', strip: false },
  md: { box: 'h-9', text: 'px-2.5 font-display text-plate', strip: true },
  lg: { box: 'h-13', text: 'px-3.5 font-display text-h1 font-bold tracking-wide', strip: true },
} as const

/** The signature element: an Indian number plate (docs 06 section 6). */
export function PlateChip({ plate, size = 'md', className }: PlateChipProps) {
  const { t } = useTranslation('common')
  const s = sizes[size]
  const text = formatPlate(plate)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-stretch overflow-hidden rounded-xs border-solid border-ink bg-surface text-ink',
        s.box,
        className,
      )}
      style={{ borderWidth: 1.5 }}
      aria-label={text}
    >
      {s.strip ? (
        <span aria-hidden="true" className="flex w-3.5 shrink-0 items-center justify-center bg-primary text-on-primary">
          <svg viewBox="0 0 14 36" className="h-full w-3.5" preserveAspectRatio="xMidYMid meet">
            <text
              x="7"
              y="18"
              fill="currentColor"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(-90 7 18)"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {t('plateCountry')}
            </text>
          </svg>
        </span>
      ) : null}
      <span aria-hidden="true" className={cn('flex items-center whitespace-nowrap tabular-nums', s.text)}>
        {text}
      </span>
    </span>
  )
}
