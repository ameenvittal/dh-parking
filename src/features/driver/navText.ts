import type { TFunction } from 'i18next'
import { ArrowUp, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, MapPin, Undo2, type LucideIcon } from 'lucide-react'
import { roundStepDistance, type Step, type StepType } from '@/lib/geo/instructions'
import { formatDistance } from '@/lib/format'

/** Arrow icons from docs/07 section 2.3. Sharp turns use the corner icon rotated. */
export const STEP_ICONS: Record<StepType, { icon: LucideIcon; rotate?: boolean }> = {
  start: { icon: ArrowUp },
  straight: { icon: ArrowUp },
  slight_left: { icon: ArrowUpLeft },
  slight_right: { icon: ArrowUpRight },
  left: { icon: CornerUpLeft },
  right: { icon: CornerUpRight },
  sharp_left: { icon: CornerUpLeft, rotate: true },
  sharp_right: { icon: CornerUpRight, rotate: true },
  uturn: { icon: Undo2 },
  arrive: { icon: MapPin },
}

const IN_KEYS: Partial<Record<StepType, string>> = {
  left: 'turnLeftIn',
  right: 'turnRightIn',
  sharp_left: 'turnLeftIn',
  sharp_right: 'turnRightIn',
  slight_left: 'slightLeftIn',
  slight_right: 'slightRightIn',
  uturn: 'uturnIn',
}

const NOW_KEYS: Partial<Record<StepType, string>> = {
  left: 'turnLeftNow',
  right: 'turnRightNow',
  sharp_left: 'turnLeftNow',
  sharp_right: 'turnRightNow',
  slight_left: 'slightLeftNow',
  slight_right: 'slightRightNow',
  uturn: 'uturnNow',
}

/** Main instruction line: "Turn left in 40 m", "Continue for 120 m", "Your slot is on the right". */
export function stepText(t: TFunction, step: Step, distanceM: number): string {
  const rounded = roundStepDistance(distanceM)
  if (step.type === 'arrive') {
    if (rounded === null) return step.side === 'left' ? t('driver.nav.slotOnLeft') : t('driver.nav.slotOnRight')
    return t('driver.nav.continueFor', { distance: formatDistance(rounded) })
  }
  if (step.type === 'straight' || step.type === 'start') {
    return t('driver.nav.continueFor', { distance: formatDistance(rounded ?? distanceM) })
  }
  if (rounded === null) return t(`driver.nav.${NOW_KEYS[step.type] ?? 'turnLeftNow'}`)
  return t(`driver.nav.${IN_KEYS[step.type] ?? 'turnLeftIn'}`, { distance: formatDistance(rounded) })
}

/** Second line: what comes after the next manoeuvre. */
export function thenText(t: TFunction, current: Step, distanceM: number, next: Step | null): string | null {
  if (current.type === 'arrive') {
    if (roundStepDistance(distanceM) === null) return null
    return current.side === 'left' ? t('driver.nav.slotOnLeft') : t('driver.nav.slotOnRight')
  }
  if (!next) return null
  if (next.type === 'arrive') return t('driver.nav.then.arrive')
  return t(`driver.nav.then.${next.type}`, { distance: formatDistance(roundStepDistance(next.distanceM) ?? next.distanceM) })
}
