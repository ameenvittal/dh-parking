import { useEffect, useRef } from 'react'
import { onPosition, onTablesChange, publishPosition } from '@/lib/demo/db'
import type { DemoTable } from '@/lib/demo/types'
import type { Position } from '@/types/domain'

/**
 * Realtime in demo mode (contract 3). Table changes come from any tab through the
 * demo database's BroadcastChannel. Positions are broadcast only, never persisted here;
 * drivers also call recordPosition every 15 s for the stored trail.
 */

export type { DemoTable }

/** Calls `onChange(table)` for every changed table in `tables`. The callback may change between renders. */
export function useRealtime(tables: DemoTable[], onChange: (table: DemoTable) => void): void {
  const cb = useRef(onChange)
  useEffect(() => {
    cb.current = onChange
  })
  const key = [...tables].sort().join(',')
  useEffect(() => {
    const wanted = new Set(key.split(',') as DemoTable[])
    return onTablesChange((changed) => {
      changed.forEach((t) => {
        if (wanted.has(t)) cb.current(t)
      })
    })
  }, [key])
}

/** Receives every live position broadcast by driver tabs (admin live map). */
export function usePositions(onPositionMessage: (p: Position) => void): void {
  const cb = useRef(onPositionMessage)
  useEffect(() => {
    cb.current = onPositionMessage
  })
  useEffect(() => onPosition((p) => cb.current(p)), [])
}

/** Driver side: broadcast the current position to other tabs. */
export function sendPosition(p: Position): void {
  publishPosition(p)
}

/** Non-hook variant for stores and effects that manage their own lifetime. */
export function subscribeTables(tables: DemoTable[], onChange: (table: DemoTable) => void): () => void {
  const wanted = new Set(tables)
  return onTablesChange((changed) => changed.forEach((t) => wanted.has(t) && onChange(t)))
}
