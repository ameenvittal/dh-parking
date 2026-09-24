import { z } from 'zod'
import { isValidIndianPlate, normalizePlate } from '@/lib/plate'
import { VEHICLE_TYPES, VISITOR_CATEGORIES } from '@/types/domain'
import type { ExtractResult, VehicleType, VisitorCategory } from '@/types/domain'
import { getPhotoBase64 } from './photos'
import type { ExtractResponse } from './types'

/**
 * extract-vehicle in demo mode: posts the photos to the Vite dev proxy
 * (POST /api/extract-vehicle, Gemini key stays on the dev server), validates with zod and
 * post-processes per docs/04 section 8.1. When the proxy has no key (or no proxy exists),
 * a plausible simulated result is returned after about 1.5 s.
 */

const TIMEOUT_MS = 12_000

const rawSchema = z.object({
  plate_number: z.string().nullable().optional(),
  plate_confidence: z.number().optional(),
  vehicle_type: z.string().nullable().optional(),
  vehicle_type_confidence: z.number().optional(),
  vehicle_color: z.string().nullable().optional(),
  vehicle_make: z.string().nullable().optional(),
  pass_detected: z.boolean().optional(),
  pass_category: z.string().nullable().optional(),
  pass_number: z.string().nullable().optional(),
  pass_holder_name: z.string().nullable().optional(),
})

const responseSchema = z.object({
  result: z.unknown().nullable(),
  error: z.object({ code: z.string(), reason: z.string().optional() }).optional(),
  model: z.string().optional(),
  ms: z.number().optional(),
})

const clamp = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)
const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

export function postProcess(raw: z.infer<typeof rawSchema>): ExtractResult {
  const plate_raw = clean(raw.plate_number)
  const plate = plate_raw ? normalizePlate(plate_raw) || null : null
  const vt = raw.vehicle_type?.toLowerCase()
  const pc = raw.pass_category?.toLowerCase()
  return {
    plate,
    plate_raw,
    plate_valid: plate ? isValidIndianPlate(plate) : false,
    plate_confidence: clamp(raw.plate_confidence),
    vehicle_type: VEHICLE_TYPES.includes(vt as VehicleType) ? (vt as VehicleType) : null,
    vehicle_type_confidence: clamp(raw.vehicle_type_confidence),
    vehicle_color: clean(raw.vehicle_color)?.toLowerCase() ?? null,
    vehicle_make: clean(raw.vehicle_make),
    pass_detected: raw.pass_detected === true,
    pass_category: VISITOR_CATEGORIES.includes(pc as VisitorCategory) ? (pc as VisitorCategory) : null,
    pass_number: clean(raw.pass_number),
    pass_holder_name: clean(raw.pass_holder_name),
  }
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]

function simulatedResult(): ExtractResult {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const district = String(1 + Math.floor(Math.random() * 60)).padStart(2, '0')
  const series = pick([...letters]) + pick([...letters])
  const num = String(1000 + Math.floor(Math.random() * 9000))
  const isBike = Math.random() < 0.3
  const hasPass = Math.random() < 0.5
  return postProcess({
    plate_number: `KL${district}${series}${num}`,
    plate_confidence: 0.78 + Math.random() * 0.2,
    vehicle_type: isBike ? 'bike' : 'car',
    vehicle_type_confidence: 0.95,
    vehicle_color: pick(['white', 'silver', 'grey', 'black', 'red', 'blue']),
    vehicle_make: isBike
      ? pick(['Honda', 'TVS', 'Royal Enfield', 'Bajaj'])
      : pick(['Maruti Suzuki', 'Hyundai', 'Tata', 'Toyota', 'Mahindra']),
    pass_detected: hasPass,
    pass_category: hasPass ? pick(['guest', 'faculty', 'student', 'vip']) : null,
    pass_number: hasPass ? `G-${String(Math.floor(Math.random() * 999)).padStart(4, '0')}` : null,
    pass_holder_name: null,
  })
}

function failed(started: number): ExtractResponse {
  return { result: null, error: { code: 'AI_FAILED' }, model: null, ms: Date.now() - started, simulated: false }
}

async function simulate(started: number): Promise<ExtractResponse> {
  await new Promise((r) => setTimeout(r, 1500))
  return { result: simulatedResult(), error: null, model: 'simulated', ms: Date.now() - started, simulated: true }
}

export async function extractVehicle(photoPaths: string[]): Promise<ExtractResponse> {
  const started = Date.now()
  const images = photoPaths
    .slice(0, 2)
    .map((p) => getPhotoBase64(p))
    .filter((b): b is string => !!b)
  if (images.length === 0) return failed(started)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/extract-vehicle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
      signal: controller.signal,
    })
    // No dev proxy at all (static build): simulate.
    if (res.status === 404 || res.status === 405) return simulate(started)
    if (!res.ok) return failed(started)
    const parsed = responseSchema.safeParse(await res.json())
    if (!parsed.success) return failed(started)
    if (parsed.data.error?.reason === 'NO_KEY') return simulate(started)
    if (!parsed.data.result) return failed(started)
    const raw = rawSchema.safeParse(parsed.data.result)
    if (!raw.success) return failed(started)
    return {
      result: postProcess(raw.data),
      error: null,
      model: parsed.data.model ?? null,
      ms: Date.now() - started,
      simulated: false,
    }
  } catch {
    return failed(started)
  } finally {
    clearTimeout(timer)
  }
}
