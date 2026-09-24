import { useEffect, useMemo, useState } from 'react'
import { DEFAULTS } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'
import type { EventMapData } from '@/types/domain'

export type GateOption = { id: string; name: string; name_ml: string | null; kind: string }

function readStored(): string | null {
  try {
    return localStorage.getItem(DEFAULTS.gateStorageKey)
  } catch {
    return null
  }
}

/**
 * The gate this device works at, stored in localStorage `eventpark.gate` (docs/07 section 3.1).
 * Only gates the volunteer is allowed (profile gate_ids, empty = all) and that allow entry or exit.
 */
export function useGateSelection(eventMap: EventMapData | null) {
  const { session } = useAuth()
  const allowedIds = session?.gateIds ?? []
  const allowedKey = allowedIds.join(',')
  const gates: GateOption[] = useMemo(
    () =>
      (eventMap?.gates.features ?? [])
        .filter((g) => g.id && (allowedIds.length === 0 || allowedIds.includes(g.id)))
        .map((g) => ({ id: g.id as string, name: g.properties.name, name_ml: g.properties.name_ml, kind: g.properties.kind })),
    [eventMap, allowedKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [stored, setStored] = useState<string | null>(readStored)

  const gate = gates.find((g) => g.id === stored) ?? gates[0] ?? null

  useEffect(() => {
    if (gate && gate.id !== stored) {
      try {
        localStorage.setItem(DEFAULTS.gateStorageKey, gate.id)
      } catch {
        /* ignore */
      }
    }
  }, [gate, stored])

  const selectGate = (id: string) => {
    try {
      localStorage.setItem(DEFAULTS.gateStorageKey, id)
    } catch {
      /* ignore */
    }
    setStored(id)
  }

  return { gates, gate, selectGate }
}
