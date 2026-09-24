import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ExtractResult, Language, PaymentMethod, VehicleType, VisitorCategory, WaStatus } from '@/types/domain'

/** Check-in wizard store (docs/07 section 3.2), kept in sessionStorage so a refresh keeps progress. */

export type CheckinStep = 'photo' | 'details' | 'phone' | 'slot' | 'done'
export type AiStatus = 'idle' | 'uploading' | 'reading' | 'done' | 'failed' | 'skipped'

export type CheckinDetails = {
  plateRaw: string
  vehicleType: VehicleType
  color: string
  make: string
  category: VisitorCategory
  passNumber: string
  passHolderName: string
  needsAccessible: boolean
}

export type CheckinSlot = { id: string; label: string; zoneCode: string; zoneName: string }
export type CheckinResultState = { visitId: string; link: string; waMessageId: string; waStatus: WaStatus }

type CheckinData = {
  step: CheckinStep
  photoPaths: string[]
  aiStatus: AiStatus
  ai: ExtractResult | null
  details: CheckinDetails
  phone: { number: string; name: string; language: Language }
  slot: CheckinSlot | null
  fee: { amount: number; method: PaymentMethod }
  result: CheckinResultState | null
  /** Admin chose "Continue anyway" on the duplicate warning. */
  allowDuplicate: boolean
  /** When the volunteer started this check-in, for checkin_duration_ms. */
  startedAt: number | null
}

type CheckinActions = {
  setStep: (step: CheckinStep) => void
  patch: (p: Partial<CheckinData>) => void
  setDetails: (d: Partial<CheckinDetails>) => void
  start: () => void
  reset: () => void
}

export type CheckinState = CheckinData & CheckinActions

export const EMPTY_DETAILS: CheckinDetails = {
  plateRaw: '',
  vehicleType: 'car',
  color: '',
  make: '',
  category: 'general',
  passNumber: '',
  passHolderName: '',
  needsAccessible: false,
}

const initial: CheckinData = {
  step: 'photo',
  photoPaths: [],
  aiStatus: 'idle',
  ai: null,
  details: EMPTY_DETAILS,
  phone: { number: '', name: '', language: 'en' },
  slot: null,
  fee: { amount: 0, method: 'free' },
  result: null,
  allowDuplicate: false,
  startedAt: null,
}

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      ...initial,
      setStep: (step) => set({ step }),
      patch: (p) => set(p),
      setDetails: (d) => set({ details: { ...get().details, ...d } }),
      start: () => {
        if (get().startedAt === null) set({ startedAt: Date.now() })
      },
      reset: () => set({ ...initial, details: { ...EMPTY_DETAILS } }),
    }),
    { name: 'eventpark.checkin', storage: createJSONStorage(() => sessionStorage) },
  ),
)
