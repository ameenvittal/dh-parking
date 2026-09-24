import { create } from 'zustand'

/** Per-tab driver choices: location sharing switch and "Continue without it" on the consent screen. */

const SHARING_KEY = 'eventpark.driver.sharing'
const SKIP_KEY = 'eventpark.driver.consentSkipped'

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
}

type DriverPrefs = {
  sharing: boolean
  consentSkipped: boolean
  /** Visit id whose "Mark as parked" was far from the slot (shows the warning on home). */
  mismatchFor: string | null
  setSharing: (on: boolean) => void
  skipConsent: () => void
  setMismatch: (visitId: string | null) => void
}

export const useDriverPrefs = create<DriverPrefs>((set) => ({
  sharing: read(SHARING_KEY) !== 'off',
  consentSkipped: read(SKIP_KEY) === '1',
  mismatchFor: null,
  setMismatch: (visitId) => set({ mismatchFor: visitId }),
  setSharing: (on) => {
    write(SHARING_KEY, on ? 'on' : 'off')
    set({ sharing: on })
  },
  skipConsent: () => {
    write(SKIP_KEY, '1')
    set({ consentSkipped: true })
  },
}))
