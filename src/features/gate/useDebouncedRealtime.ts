import { useEffect, useRef } from 'react'
import { useRealtime, type DemoTable } from '@/lib/realtime'

/** Calls `onChange` at most once per `ms` after changes on `tables` (gate home refresh, docs/07 section 3.1). */
export function useDebouncedRealtime(tables: DemoTable[], onChange: () => void, ms = 2000) {
  const timer = useRef<number | null>(null)
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  })
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )
  useRealtime(tables, () => {
    if (timer.current !== null) return
    timer.current = window.setTimeout(() => {
      timer.current = null
      cb.current()
    }, ms)
  })
}
