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

  const [vehicles, setVehicles] = useState<LiveVehicleView[]>([])
  useEffect(() => {
    const run = () => setVehicles(merge(seed.data ?? [], positions.current, Date.now()))
    const first = setTimeout(run, 0)
    const id = setInterval(run, FLUSH_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [seed.data])

  return { vehicles, isLoading: seed.isLoading, error: seed.error }
}

function merge(seed: LiveVehicle[], positions: Map<string, Position>, now: number): LiveVehicleView[] {
  const out: LiveVehicleView[] = []
  for (const v of seed) {
    if (v.status !== 'assigned' && v.status !== 'en_route' && v.status !== 'driver_parked') continue
    const p = positions.get(v.visit_id)
    const seedAt = new Date(v.at).getTime()
    const live = p && p.t >= seedAt ? p : null
    const atMs = live ? live.t : seedAt
    const age = now - atMs
    if (age > HIDE_AFTER_MS) continue
    out.push({
      ...v,
      lng: live ? live.lng : v.lng,
      lat: live ? live.lat : v.lat,
      at: new Date(atMs).toISOString(),
      atMs,
      speed: live ? live.spd : null,
      faded: age > FADE_AFTER_MS,
    })
  }
  return out
}
