import { useEffect, useRef } from 'react'
import { distance as turfDistance } from '@turf/turf'
import type { DriverVisit, VisitStatus } from '@/types/domain'
import { sendPosition } from '@/lib/realtime'
import { recordPosition } from './api'
import { useDriverPrefs } from './driverPrefs'
import type { LocationFix } from './useLiveLocation'

const SHARING_STATUSES: VisitStatus[] = ['assigned', 'en_route', 'driver_parked']
const BROADCAST_MS = 3000
const BROADCAST_MOVE_M = 10
const RECORD_MS = 15000

export function isSharingStatus(status: VisitStatus | undefined): boolean {
  return status !== undefined && SHARING_STATUSES.includes(status)
}

/**
 * docs/05 section 8.2: broadcast at most every 3 s or after 10 m, record every 15 s,
 * only while the visit is active and not yet confirmed, and only while sharing is on.
 */
export function usePositionSharing(visit: DriverVisit | null | undefined, fix: LocationFix | null) {
  const sharing = useDriverPrefs((s) => s.sharing)
  const active = sharing && isSharingStatus(visit?.visit.status) && Boolean(visit?.driver.location_consent_at)
  const visitId = visit?.visit.id ?? null
  const fixRef = useRef(fix)
  const lastSent = useRef<{ at: number; lng: number; lat: number } | null>(null)

  useEffect(() => {
    fixRef.current = fix
    if (!active || !visitId || !fix) return
    const now = Date.now()
    const prev = lastSent.current
    const moved = prev ? turfDistance([prev.lng, prev.lat], [fix.lng, fix.lat], { units: 'meters' }) : Infinity
    if (prev && now - prev.at < BROADCAST_MS && moved < BROADCAST_MOVE_M) return
    lastSent.current = { at: now, lng: fix.lng, lat: fix.lat }
    sendPosition({ visit_id: visitId, lat: fix.lat, lng: fix.lng, acc: fix.accuracy, hdg: fix.heading, spd: fix.speed, t: now })
  }, [active, visitId, fix])

  useEffect(() => {
    if (!active) return
    const push = () => {
      const f = fixRef.current
      if (!f) return
      void recordPosition({ lng: f.lng, lat: f.lat, accuracy_m: f.accuracy, heading: f.heading, speed_mps: f.speed }).catch(() => {
        /* next tick retries */
      })
    }
    push()
    const id = window.setInterval(push, RECORD_MS)
    return () => window.clearInterval(id)
  }, [active])

  return { active }
}
