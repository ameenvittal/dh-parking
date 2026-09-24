import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { along as turfAlong, bearing as turfBearing, destination, length as turfLength, lineString } from '@turf/turf'
import { Pause, Play, Route as RouteIcon, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setSimulatedFix } from './useLiveLocation'

type SimulateDriveProps = {
  /** Called when the simulation starts: the path to follow, [lng, lat][]. */
  buildPath: () => number[][] | null
  /** 25 km/h driving, 5 km/h walking. */
  mode: 'drive' | 'walk'
  className?: string
}

const TICK_MS = 1000
const OFF_ROUTE_TICKS = 4
const OFF_ROUTE_M = 45

type Run = { coords: number[][]; lengthM: number; alongM: number; offTicks: number }

/**
 * Demo mode only: moves the user puck along the route so navigation, off-route rerouting
 * and arrival can be shown away from campus. Feeds features/sim/demoGps.
 */
export function SimulateDrive({ buildPath, mode, className }: SimulateDriveProps) {
  const { t } = useTranslation('driver')
  const [state, setState] = useState<'idle' | 'running' | 'paused'>('idle')
  const run = useRef<Run | null>(null)
  const speed = mode === 'drive' ? 25 / 3.6 : 5 / 3.6

  useEffect(() => {
    if (state !== 'running') return
    const id = window.setInterval(() => {
      const r = run.current
      if (!r) return
      r.alongM = Math.min(r.lengthM, r.alongM + speed)
      const line = lineString(r.coords)
      const here = turfAlong(line, r.alongM, { units: 'meters' })
      const ahead = turfAlong(line, Math.min(r.lengthM, r.alongM + 3), { units: 'meters' })
      const heading = r.alongM < r.lengthM ? turfBearing(here, ahead) : null
      let pos = here.geometry.coordinates
      if (r.offTicks > 0 && heading !== null) {
        pos = destination(here, OFF_ROUTE_M, heading + 90, { units: 'meters' }).geometry.coordinates
        r.offTicks -= 1
      }
      const done = r.alongM >= r.lengthM
      setSimulatedFix({
        lng: pos[0],
        lat: pos[1],
        accuracy: 8,
        heading: heading === null ? null : (heading + 360) % 360,
        speed: done ? 0 : speed,
        at: Date.now(),
      })
      if (done) setState('idle')
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [state, speed])

  const start = () => {
    const coords = buildPath()
    if (!coords || coords.length < 2) return
    const lengthM = turfLength(lineString(coords), { units: 'meters' })
    run.current = { coords, lengthM, alongM: 0, offTicks: 0 }
    setSimulatedFix({ lng: coords[0][0], lat: coords[0][1], accuracy: 8, heading: null, speed: 0, at: Date.now() })
    setState('running')
  }

  const stop = () => {
    run.current = null
    setState('idle')
    setSimulatedFix(null)
  }

  const btn =
    'pointer-events-auto inline-flex h-11 items-center gap-2 rounded-md bg-surface px-3 text-body-sm font-semibold text-ink shadow-overlay outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus'

  return (
    <div className={cn('pointer-events-none flex flex-wrap items-center gap-2', className)}>
      {state === 'idle' ? (
        <button type="button" className={btn} onClick={start}>
          <Play size={20} strokeWidth={1.75} aria-hidden="true" className="text-primary" />
          {mode === 'drive' ? t('driver.driveSim.drive') : t('driver.driveSim.walk')}
        </button>
      ) : (
        <>
          <button type="button" className={btn} onClick={() => setState(state === 'running' ? 'paused' : 'running')}>
            {state === 'running' ? (
              <Pause size={20} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Play size={20} strokeWidth={1.75} aria-hidden="true" />
            )}
            {state === 'running' ? t('driver.driveSim.pause') : t('driver.driveSim.resume')}
          </button>
          {state === 'running' ? (
            <button
              type="button"
              className={btn}
              onClick={() => {
                if (run.current) run.current.offTicks = OFF_ROUTE_TICKS
              }}
            >
              <RouteIcon size={20} strokeWidth={1.75} aria-hidden="true" />
              {t('driver.driveSim.offRoute')}
            </button>
          ) : null}
          <button type="button" className={btn} onClick={stop} aria-label={t('driver.driveSim.stop')} title={t('driver.driveSim.stop')}>
            <Square size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  )
}
