import { useEffect, useMemo, useRef, useState } from 'react'
import { distance as turfDistance } from '@turf/turf'
import type { EventMapData, LngLat } from '@/types/domain'
import { MAX_SNAP_M, cachedGraph, findRoute, nearestNetworkDistance, routeProgress, type Route, type RouteMode } from '@/lib/geo/routing'
import type { Step } from '@/lib/geo/instructions'
import type { LocationFix } from './useLiveLocation'

export type GuidanceState = 'waiting' | 'offCampus' | 'noRoute' | 'rerouting' | 'routing'

const OFF_ROUTE_M = 25
const OFF_ROUTE_FIXES = 2
const OFF_ROUTE_MAX_ACCURACY_M = 40
const REROUTE_NOTICE_MS = 600
const STEP_PASSED_M = 5

type Guidance = {
  state: GuidanceState
  route: Route | null
  /** Next manoeuvre ahead of the user, and the one after it. */
  step: Step | null
  nextStep: Step | null
  /** Metres to `step`. */
  stepDistanceM: number | null
  /** Metres left, legs included. */
  remainingM: number | null
  /** Route from the entry gate, drawn while the driver is not on campus yet. */
  gateRoute: Route | null
}

type Options = {
  eventMap: EventMapData | null
  mode: RouteMode
  fix: LocationFix | null
  target: LngLat | null
  gate: LngLat | null
}

/** Navigation loop from docs/05 section 8.3: route on first fix, reroute after 2 off-route fixes, progress. */
export function useRouteGuidance({ eventMap, mode, fix, target, gate }: Options): Guidance {
  const graph = useMemo(
    () => (eventMap ? cachedGraph(eventMap.roads, mode, `${eventMap.event.id}:${eventMap.version}`) : null),
    [eventMap, mode],
  )
  const targetKey = target ? `${target[0]},${target[1]}` : ''
  const [route, setRoute] = useState<{ key: string; route: Route | null; state: GuidanceState } | null>(null)
  const [rerouting, setRerouting] = useState(false)
  const offCount = useRef(0)

  const fixLng = fix?.lng
  const fixLat = fix?.lat
  const fixAcc = fix?.accuracy ?? Infinity

  // Compute (or recompute) the route when there is none for this target yet.
  useEffect(() => {
    if (!eventMap || !graph || !target || fixLng === undefined || fixLat === undefined) return
    if (route && route.key === targetKey && !rerouting) return
    const compute = () => {
      const from: LngLat = [fixLng, fixLat]
      const snapM = nearestNetworkDistance(eventMap.roads, from, mode)
      if (snapM === null || snapM > MAX_SNAP_M) {
        setRoute({ key: targetKey, route: null, state: snapM === null ? 'noRoute' : 'offCampus' })
      } else {
        const r = findRoute(graph, eventMap.roads, from, target, mode)
        setRoute({ key: targetKey, route: r, state: r ? 'routing' : 'noRoute' })
      }
      offCount.current = 0
      setRerouting(false)
    }
    if (rerouting) {
      const id = window.setTimeout(compute, REROUTE_NOTICE_MS)
      return () => window.clearTimeout(id)
    }
    compute()
  }, [eventMap, graph, mode, target, targetKey, fixLng, fixLat, route, rerouting])

  const current = route && route.key === targetKey ? route : null

  // Off campus: re-check on each fix, the driver may have entered the campus.
  useEffect(() => {
    if (!current || current.state !== 'offCampus' || !eventMap || fixLng === undefined || fixLat === undefined) return
    const snapM = nearestNetworkDistance(eventMap.roads, [fixLng, fixLat], mode)
    if (snapM !== null && snapM <= MAX_SNAP_M) setRerouting(true)
  }, [current, eventMap, mode, fixLng, fixLat])

  // Off-route check: 2 consecutive good fixes more than 25 m from the line.
  const progress = useMemo(() => {
    if (!current?.route || fixLng === undefined || fixLat === undefined) return null
    return routeProgress(current.route.line, [fixLng, fixLat])
  }, [current, fixLng, fixLat])

  useEffect(() => {
    if (!progress || rerouting) return
    if (fixAcc < OFF_ROUTE_MAX_ACCURACY_M && progress.offRouteM > OFF_ROUTE_M) {
      offCount.current += 1
      if (offCount.current >= OFF_ROUTE_FIXES) setRerouting(true)
    } else {
      offCount.current = 0
    }
  }, [progress, fixAcc, rerouting])

  const gateRoute = useMemo(() => {
    if (!graph || !eventMap || !gate || !target || current?.state !== 'offCampus') return null
    return findRoute(graph, eventMap.roads, gate, target, mode)
  }, [graph, eventMap, gate, target, mode, current?.state])

  if (!fix || !target) {
    return { state: 'waiting', route: null, step: null, nextStep: null, stepDistanceM: null, remainingM: null, gateRoute: null }
  }
  if (rerouting) {
    return { state: 'rerouting', route: current?.route ?? null, step: null, nextStep: null, stepDistanceM: null, remainingM: null, gateRoute }
  }
  if (!current) {
    return { state: 'waiting', route: null, step: null, nextStep: null, stepDistanceM: null, remainingM: null, gateRoute: null }
  }
  if (!current.route || !progress) {
    return { state: current.state, route: null, step: null, nextStep: null, stepDistanceM: null, remainingM: null, gateRoute }
  }

  const r = current.route
  const steps = r.steps.filter((s) => s.type !== 'start')
  const idx = steps.findIndex((s) => s.alongM > progress.alongM + STEP_PASSED_M || s.type === 'arrive')
  const step = idx >= 0 ? steps[idx] : null
  const nextStep = idx >= 0 && idx + 1 < steps.length ? steps[idx + 1] : null
  const remainingM = progress.remainingM + lineMetres(r.lastLeg.geometry.coordinates)
  return {
    state: 'routing',
    route: r,
    step,
    nextStep,
    stepDistanceM: step ? Math.max(0, step.alongM - progress.alongM) : null,
    remainingM,
    gateRoute: null,
  }
}

function lineMetres(coords: number[][]): number {
  let m = 0
  for (let i = 1; i < coords.length; i++) m += turfDistance(coords[i - 1], coords[i], { units: 'meters' })
  return m
}
