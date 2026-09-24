import { useEffect } from 'react'
import { create } from 'zustand'
import { setDemoFix, stopDemoGps, useDemoGps } from '@/features/sim/demoGps'

/**
 * Live location (docs/05 section 8.1). One shared `watchPosition` for every driver
 * screen, kept in a small zustand store (the "live location store" in docs/02 section 3)
 * so moving from home to navigate does not re-prompt or lose the last fix.
 * A simulated fix (demo GPS) takes priority over the device while it is active.
 */

export type LocationStatus = 'idle' | 'prompt' | 'denied' | 'unavailable' | 'watching'
export type LocationFix = {
  lng: number
  lat: number
  accuracy: number
  heading: number | null
  speed: number | null
  at: number
}

type LocationState = {
  status: LocationStatus
  deviceFix: LocationFix | null
}

export const useLocationStore = create<LocationState>(() => ({ status: 'idle', deviceFix: null }))

/** Demo GPS (features/sim/demoGps): feed a simulated fix; null returns to the device GPS. */
export function setSimulatedFix(fix: LocationFix | null): void {
  if (fix) setDemoFix(fix)
  else stopDemoGps()
}

const WATCH_OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
const SMOOTHING_MAX_ACCURACY_M = 100
const HEADING_MIN_SPEED_MPS = 1

let consumers = 0
let watchId: number | null = null

function onPosition(pos: GeolocationPosition) {
  const prev = useLocationStore.getState().deviceFix
  const { longitude, latitude, accuracy, heading, speed } = pos.coords
  const moving = speed !== null && speed > HEADING_MIN_SPEED_MPS
  const nextHeading = moving && heading !== null && Number.isFinite(heading) ? heading : (prev?.heading ?? null)
  // Poor fixes still update the accuracy circle but do not move the puck.
  const coarse = accuracy > SMOOTHING_MAX_ACCURACY_M && prev !== null
  useLocationStore.setState({
    status: 'watching',
    deviceFix: {
      lng: coarse ? prev.lng : longitude,
      lat: coarse ? prev.lat : latitude,
      accuracy,
      heading: nextHeading,
      speed,
      at: pos.timestamp,
    },
  })
}

function onError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) useLocationStore.setState({ status: 'denied' })
  else if (useLocationStore.getState().deviceFix === null) useLocationStore.setState({ status: 'unavailable' })
}

function start() {
  if (watchId !== null) return
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    useLocationStore.setState({ status: 'unavailable' })
    return
  }
  if (useLocationStore.getState().status !== 'watching') useLocationStore.setState({ status: 'prompt' })
  watchId = navigator.geolocation.watchPosition(onPosition, onError, WATCH_OPTIONS)
}

function stop() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  watchId = null
  const s = useLocationStore.getState().status
  if (s === 'watching' || s === 'prompt') useLocationStore.setState({ status: 'idle' })
}

/** Reads the browser permission without prompting. Resolves 'granted', 'denied', 'prompt' or 'unknown'. */
export async function queryLocationPermission(): Promise<PermissionState | 'unknown'> {
  try {
    if (!navigator.permissions) return 'unknown'
    const res = await navigator.permissions.query({ name: 'geolocation' })
    return res.state
  } catch {
    return 'unknown'
  }
}

/** `useLiveLocation({ enabled })` from docs/05 section 8.1. Stops when every consumer is disabled or unmounted. */
export function useLiveLocation({ enabled }: { enabled: boolean }): { status: LocationStatus; fix: LocationFix | null } {
  const status = useLocationStore((s) => s.status)
  const deviceFix = useLocationStore((s) => s.deviceFix)
  const demoFix = useDemoGps((s) => (s.enabled ? s.position : null))

  useEffect(() => {
    if (!enabled) return
    consumers += 1
    start()
    return () => {
      consumers -= 1
      if (consumers <= 0) {
        consumers = 0
        stop()
      }
    }
  }, [enabled])

  if (demoFix) return { status: 'watching', fix: demoFix }
  if (!enabled) return { status: status === 'denied' ? 'denied' : 'idle', fix: null }
  return { status, fix: deviceFix }
}

/** The latest known fix without starting a watch (SOS uses whatever fix the page already has). */
export function useLastFix(): LocationFix | null {
  const deviceFix = useLocationStore((s) => s.deviceFix)
  const demoFix = useDemoGps((s) => (s.enabled ? s.position : null))
  return demoFix ?? deviceFix
}
