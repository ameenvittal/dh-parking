import { CircleHelp, Info, LogIn, Stethoscope, Theater, Toilet, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import type { LandmarkKind } from '@/types/domain'

/** Landmark kind icons, shared by map markers and landmark lists. */
export const LANDMARK_ICONS: Record<LandmarkKind, LucideIcon> = {
  venue: Theater,
  entrance: LogIn,
  help_desk: Info,
  first_aid: Stethoscope,
  toilet: Toilet,
  food: UtensilsCrossed,
  other: CircleHelp,
}
