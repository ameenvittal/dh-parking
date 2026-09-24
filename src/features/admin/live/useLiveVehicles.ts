import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { queryKeys } from '@/lib/queryKeys'
import { usePositions, useRealtime } from '@/lib/realtime'
import type { LiveVehicle, Position } from '@/types/domain'
import { getLiveVehicles } from './api'

/** Positions older than this are faded (docs/05 section 9). */
export const FADE_AFTER_MS = 60_000
/** Positions older than this are removed. */
export const HIDE_AFTER_MS = 5 * 60_000
const FLUSH_MS = 1_000

export type LiveVehicleView = LiveVehicle & { atMs: number; speed: number | null; faded: boolean }

/**
 * Live vehicles: seeded with get_live_vehicles, then moved by broadcast positions. Positions are
 * kept in a ref and flushed to React state once per second. Confirmed and ended visits are dropped.
 */
export function useLiveVehicles(eventId: string | null) {
  const qc = useQueryClient()
  const seed = useQuery({
    queryKey: queryKeys.liveVehicles(eventId ?? ''),
    queryFn: () => getLiveVehicles(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const positions = useRef(new Map<string, Position>())
  const [tick, setTick] = useState(0)

  const onVisits = useCallback(() => {
    if (eventId) void qc.invalidateQueries({ queryKey: queryKeys.liveVehicles(eventId) })
  }, [qc, eventId])
  useRealtime(['visits'], onVisits)

  const known = useRef(new Set<string>())
  useEffect(() => {
    known.current = new Set((seed.data ?? []).map((v) => v.visit_id))
  }, [seed.data])

  usePositions((p) => {
    positions.current.set(p.visit_id, p)
    // A vehicle we have not seen yet: refresh plate and status.
    if (!known.current.has(p.visit_id)) {
      known.current.add(p.visit_id)
      onVisits()
    }
  })

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), FLUSH_MS)
    return () => clearInterval(id)
  }, [])

  const now = Date.now()
  const vehicles: LiveVehicleView[] = []
  for (const v of seed.data ?? []) {
    if (v.status !== 'assigned' && v.status !== 'en_route' && v.status !== 'driver_parked') continue
    const p = positions.current.get(v.visit_id)
    const seedAt = new Date(v.at).getTime()
    const useLive = p && p.t >= seedAt
    const atMs = useLive ? p.t : seedAt
    const age = now - atMs
    if (age > HIDE_AFTER_MS) continue
    vehicles.push({
      ...v,
      lng: useLive ? p.lng : v.lng,
      lat: useLive ? p.lat : v.lat,
      at: new Date(atMs).toISOString(),
      atMs,
      speed: useLive ? p.spd : null,
      faded: age > FADE_AFTER_MS,
    })
  }
  return { vehicles, isLoading: seed.isLoading, error: seed.error, tick }
}
