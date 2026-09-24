import { APP_URL } from '@/config/app'
import { AppError } from '@/lib/errors'
import { formatPlate } from '@/lib/format'
import type {
  AlertRow,
  EventRow,
  Language,
  PaymentMethod,
  SlotRow,
  VehicleType,
  VisitEventType,
  VisitRow,
  VisitStatus,
  VisitorCategory,
} from '@/types/domain'
import { distM, insertAlert, isActive, newId } from './core'
import { mutate, nextSeq, readDb, type DemoDb } from './db'
import { getSession } from './session'
import { buildSeed } from './seed'
import { createToken } from './tokens'
import type { ActorInfo } from './types'
import { renderTemplate, guestName } from './whatsapp'
import { replaceDb } from './db'
import { clearPhotos } from './photos'

/**
 * Demo helpers behind the DemoDock: sample traffic across the event window so the
 * dashboard and reports look alive, and a full reset back to the seed.
 */

const NAMES = ['Anand', 'Fathima', 'Rahul', 'Aswathy', 'Joseph', 'Nandana', 'Arjun', 'Sneha', 'Vishnu', 'Meera', 'Akhil', 'Anjali', null, null, null]
const COLORS = ['white', 'silver', 'grey', 'black', 'red', 'blue', 'brown']
const CAR_MAKES = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Toyota', 'Mahindra', 'Honda', 'Kia']
const BIKE_MAKES = ['Honda', 'TVS', 'Royal Enfield', 'Bajaj', 'Yamaha', 'Hero']
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}
function weighted<T extends string>(w: Record<T, number>): T {
  const entries = Object.entries(w) as [T, number][]
  let r = Math.random() * entries.reduce((s, [, n]) => s + n, 0)
  for (const [k, n] of entries) {
    r -= n
    if (r <= 0) return k
  }
  return entries[0][0]
}
function plate(): string {
  const d = String(1 + Math.floor(Math.random() * 70)).padStart(2, '0')
  return `KL${d}${pick([...LETTERS])}${pick([...LETTERS])}${1000 + Math.floor(Math.random() * 9000)}`
}
function phone(): string {
  let p = `+91${pick(['94', '95', '96', '97', '98', '99', '70', '80'])}${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
  if (p.endsWith('00')) p = p.slice(0, -1) + '7'
  return p
}
const iso = (t: number) => new Date(t).toISOString()

type Interval = [number, number]

export async function addSampleTraffic(count = 120): Promise<{ added: number }> {
  const tokens = await Promise.all(Array.from({ length: count }, () => createToken()))
  return mutate((db, touch) => {
    const ev = db.events.find((e) => e.status === 'live')
    if (!ev) throw new AppError('NO_LIVE_EVENT')
    const added = generate(db, ev, count, tokens)
    touch('visits', 'slots', 'alerts', 'whatsapp_messages')
    return { added }
  })
}

function generate(db: DemoDb, ev: EventRow, count: number, tokens: { raw: string; hash: string }[]): number {
  const now = Date.now()
  const start = Math.max(new Date(ev.starts_at).getTime() - 3600_000, now - 4 * 3600_000)
  const end = now - 60_000
  const gate = db.profiles.find((p) => p.role === 'gate_volunteer') ?? db.profiles[0]
  const zoneUser = db.profiles.find((p) => p.role === 'zone_volunteer') ?? db.profiles[0]
  const gateActor: ActorInfo = { role: gate.role, id: gate.id }
  const zoneActor: ActorInfo = { role: zoneUser.role, id: zoneUser.id }
  const gates = db.gates.filter((g) => g.event_id === ev.id)
  const mainGate = gates.find((g) => g.kind !== 'entry') ?? gates[0]
  const zones = db.zones.filter((z) => z.event_id === ev.id)
  const slots = db.slots.filter((s) => s.event_id === ev.id && s.status !== 'blocked')

  // Occupied intervals per slot, including real visits that are active now.
  const busy = new Map<string, Interval[]>()
  db.visits.forEach((v) => {
    if (v.slot_id && isActive(v.status)) busy.set(v.slot_id, [...(busy.get(v.slot_id) ?? []), [new Date(v.checked_in_at).getTime(), Infinity]])
  })
  slots.forEach((s) => {
    if (s.status !== 'available' && !busy.has(s.id)) busy.set(s.id, [[0, Infinity]])
  })
  const activePlates = new Set(db.visits.filter((v) => isActive(v.status)).map((v) => v.plate))

  // Most arrivals follow a peak across the window; about one in ten are in the last few minutes
  // so there are vehicles on the way and waiting for a volunteer right now.
  const recent = Math.round(count * 0.1)
  const times = [
    ...Array.from({ length: count - recent }, () => start + ((Math.random() + Math.random() + Math.random()) / 3) * (end - start)),
    ...Array.from({ length: recent }, () => now - rand(1, 13) * 60_000),
  ].sort((a, b) => a - b)

  const log = (v: VisitRow, type: VisitEventType, at: number, actor: ActorInfo | null, data: Record<string, unknown> = {}) =>
    db.visit_events.push({ id: nextSeq(db), visit_id: v.id, event_id: ev.id, type, actor_role: actor?.role ?? null, actor_id: actor?.id ?? null, data, created_at: iso(at) })

  let added = 0
  const created: VisitRow[] = []
  times.forEach((t, i) => {
    let type: VehicleType = weighted({ bike: 34, car: 58, ev: 5, other: 3 })
    const category: VisitorCategory =
      type === 'bike'
        ? weighted({ student: 70, staff: 10, volunteer: 10, general: 10 } as Record<VisitorCategory, number>)
        : weighted({ student: 20, guest: 22, general: 18, faculty: 16, vip: 8, staff: 8, volunteer: 4, performer: 4 } as Record<VisitorCategory, number>)
    if (type === 'other') type = 'car'
    const stay = rand(25, 150) * 60_000
    const exitAt = t + stay
    const exited = exitAt < now - 60_000
    const until = exited ? exitAt : Infinity

    const free = (s: SlotRow) => (busy.get(s.id) ?? []).every(([a, b]) => until <= a || t >= b)
    const typeZones = zones.filter((z) => z.vehicle_types.includes(type))
    const catOk = typeZones.filter((z) => z.categories.length === 0 || z.categories.includes(category))
    const ordered = [...catOk.filter((z) => !z.is_overflow), ...catOk.filter((z) => z.is_overflow), ...typeZones.filter((z) => !catOk.includes(z))]
    let slot: SlotRow | undefined
    for (const z of ordered.sort((a, b) => Number(a.is_overflow) - Number(b.is_overflow) || a.priority - b.priority)) {
      const cands = slots.filter((s) => s.zone_id === z.id && s.vehicle_type === type && !s.is_accessible && free(s))
      if (cands.length) {
        slot = pick(cands.slice(0, 6))
        break
      }
    }
    if (!slot && type === 'ev') {
      type = 'car'
      slot = slots.find((s) => s.vehicle_type === 'car' && !s.is_accessible && free(s))
    }
    if (!slot) return
    let p = plate()
    while (activePlates.has(p)) p = plate()
    if (!exited) activePlates.add(p)
    busy.set(slot.id, [...(busy.get(slot.id) ?? []), [t, until]])

    const age = now - t
    let status: VisitStatus
    if (exited) status = 'exited'
    else if (age < 6 * 60_000) status = Math.random() < 0.5 ? 'assigned' : 'en_route'
    else if (age < 12 * 60_000) status = Math.random() < 0.6 ? 'driver_parked' : 'confirmed'
    else status = 'confirmed'

    const lang: Language = Math.random() < 0.25 ? 'ml' : 'en'
    const driverPhone = i === 7 ? '+919847000100' : phone()
    const driver = {
      id: newId(),
      event_id: ev.id,
      phone_e164: driverPhone,
      name: pick(NAMES),
      preferred_language: lang,
      location_consent_at: Math.random() < 0.8 ? iso(t + 90_000) : null,
      created_at: iso(t),
    }
    db.drivers.push(driver)
    const zone = zones.find((z) => z.id === slot!.zone_id)!
    const entry = Math.random() < 0.75 ? mainGate : pick(gates)
    const exempt = ev.fee_exempt_categories.includes(category)
    const fee = ev.paid_parking && !exempt ? ev.fee_rules[type] : 0
    const method: PaymentMethod = fee > 0 ? (Math.random() < 0.6 ? 'cash' : 'upi') : 'free'
    const opened = Math.random() < 0.85 ? t + rand(40, 180) * 1000 : null
    const nav = opened ? opened + rand(10, 60) * 1000 : null
    const driverMarked = Math.random() < 0.7
    const parkedAt = status === 'assigned' || status === 'en_route' ? null : t + rand(4, 9) * 60_000
    const confirmedAt = status === 'confirmed' || status === 'exited' ? (parkedAt ?? t + 6 * 60_000) + rand(1, 5) * 60_000 : null
    const mismatch = status === 'driver_parked' && added % 5 === 0
    const v: VisitRow = {
      id: newId(),
      event_id: ev.id,
      driver_id: driver.id,
      plate_raw: formatPlate(p),
      plate: p,
      vehicle_type: type,
      vehicle_color: pick(COLORS),
      vehicle_make: pick(type === 'bike' ? BIKE_MAKES : CAR_MAKES),
      category,
      pass_number: category === 'general' ? null : `${category.slice(0, 1).toUpperCase()}-${String(100 + i).padStart(4, '0')}`,
      pass_holder_name: null,
      needs_accessible: false,
      photo_path: null,
      ai_result: null,
      ai_plate_confidence: Math.round(rand(0.62, 0.99) * 100) / 100,
      ai_edited: Math.random() < 0.1,
      entry_gate_id: entry.id,
      checked_in_by: gate.id,
      checked_in_at: iso(t),
      zone_id: slot.zone_id,
      slot_id: slot.id,
      status,
      assigned_at: iso(t),
      link_opened_at: opened ? iso(opened) : null,
      navigation_started_at: nav && status !== 'assigned' ? iso(nav) : null,
      driver_parked_at: parkedAt && (driverMarked || status === 'driver_parked') ? iso(parkedAt) : null,
      driver_parked_location: null,
      driver_parked_distance_m: parkedAt && (driverMarked || status === 'driver_parked') ? (mismatch ? 68 : Math.round(rand(2, 18))) : null,
      confirmed_at: confirmedAt ? iso(confirmedAt) : null,
      confirmed_by: confirmedAt ? zoneUser.id : null,
      exited_at: exited ? iso(exitAt) : null,
      exited_by: exited ? gate.id : null,
      exit_gate_id: exited ? mainGate.id : null,
      cancelled_at: null,
      cancel_reason: null,
      checkin_duration_ms: Math.round(rand(24, 62) * 1000),
      fee_amount: fee,
      payment_method: method,
      last_position: null,
      last_position_at: null,
    }
    if (v.driver_parked_at) v.driver_parked_location = mismatch ? [slot.center[0] + 0.0006, slot.center[1]] : slot.center
    if (status === 'en_route') {
      const g = entry.location
      const f = Math.random() * 0.6 + 0.2
      v.last_position = [g[0] + (slot.center[0] - g[0]) * f, g[1] + (slot.center[1] - g[1]) * f]
      v.last_position_at = iso(now - rand(5, 40) * 1000)
      db.vehicle_positions.push({ id: nextSeq(db), visit_id: v.id, event_id: ev.id, location: g, accuracy_m: 12, heading: null, speed_mps: 4, recorded_at: iso(nav ?? t) })
      db.vehicle_positions.push({ id: nextSeq(db), visit_id: v.id, event_id: ev.id, location: v.last_position, accuracy_m: 10, heading: null, speed_mps: 3, recorded_at: v.last_position_at })
    }
    db.visits.push(v)
    created.push(v)
    added += 1

    if (!exited) {
      const live = db.slots.find((s) => s.id === slot!.id)!
      live.status = status === 'assigned' || status === 'en_route' ? 'assigned' : 'occupied'
      live.current_visit_id = v.id
      live.status_changed_at = iso(parkedAt ?? t)
    }

    // Token and WhatsApp message
    const tok = tokens[i]
    db.driver_access_tokens.push({
      id: newId(),
      driver_id: driver.id,
      token_hash: tok.hash,
      expires_at: iso(new Date(ev.ends_at).getTime() + 6 * 3600_000),
      revoked_at: null,
      last_used_at: opened ? iso(opened) : null,
      use_count: opened ? 1 : 0,
      created_at: iso(t),
    })
    const failed = driverPhone.endsWith('00')
    const zoneName = lang === 'ml' && zone.name_ml ? zone.name_ml : zone.name
    const { body, button } = renderTemplate('parking_slot_assigned', lang, [driver.name ?? guestName(lang), ev.name, slot.label, zoneName, formatPlate(p)])
    db.whatsapp_messages.push({
      id: newId(),
      event_id: ev.id,
      driver_id: driver.id,
      visit_id: v.id,
      template: 'parking_slot_assigned',
      language: lang,
      to_phone: driverPhone,
      wa_message_id: `wamid.demo.${newId().replace(/-/g, '')}`,
      status: failed ? 'failed' : opened ? 'read' : 'delivered',
      error_code: failed ? '131026' : null,
      error_title: failed ? 'Message undeliverable' : null,
      body,
      button_label: button,
      button_url: `${APP_URL}/d/${tok.raw}`,
      created_at: iso(t + 1000),
      updated_at: iso(t + 3000),
    })

    log(v, 'checked_in', t, gateActor, { gate: entry.id, ai_edited: v.ai_edited })
    log(v, 'assigned', t, gateActor, { slot_id: slot.id, label: slot.label })
    if (!failed) log(v, 'link_sent', t + 1500, null, { template: 'parking_slot_assigned' })
    if (opened) log(v, 'link_opened', opened, { role: 'driver', id: driver.id })
    if (v.navigation_started_at) log(v, 'navigation_started', nav!, { role: 'driver', id: driver.id })
    if (v.driver_parked_at) log(v, 'driver_parked', parkedAt!, { role: 'driver', id: driver.id }, { distance_m: v.driver_parked_distance_m })
    if (confirmedAt) log(v, 'confirmed', confirmedAt, zoneActor)
    if (exited) log(v, 'exited', exitAt, gateActor, { gate: mainGate.id })

    if (mismatch) {
      insertAlert(db, {
        event_id: ev.id,
        type: 'location_mismatch',
        visit_id: v.id,
        slot_id: slot.id,
        zone_id: slot.zone_id,
        location: v.driver_parked_location,
        message: '68 m from slot',
        raised_by_system: true,
        dedupe_key: `location_mismatch:${v.id}`,
        created_at: v.driver_parked_at ?? iso(now),
      })
      log(v, 'location_mismatch', parkedAt!, { role: 'driver', id: driver.id }, { distance_m: 68 })
    }
  })

  // A few handled alerts so the inbox and reports have history.
  const resolvedAlert = (a: Partial<AlertRow> & { type: AlertRow['type']; created_at: string }) =>
    insertAlert(db, {
      event_id: ev.id,
      status: 'resolved',
      resolved_at: iso(new Date(a.created_at).getTime() + 8 * 60_000),
      resolved_by: db.profiles.find((p) => p.role === 'admin')?.id ?? null,
      resolution_note: 'Handled by volunteer',
      ...a,
    })
  const exitedOnes = created.filter((v) => v.status === 'exited')
  exitedOnes.slice(0, 3).forEach((v) =>
    resolvedAlert({
      type: 'wrong_slot',
      visit_id: v.id,
      slot_id: v.slot_id,
      zone_id: v.zone_id,
      message: 'Assigned another slot, parked next to it',
      raised_by_profile: zoneUser.id,
      created_at: v.confirmed_at ?? v.checked_in_at,
    }),
  )
  const sosVisit = exitedOnes[4]
  if (sosVisit)
    resolvedAlert({
      type: 'sos',
      sos_reason: 'breakdown',
      visit_id: sosVisit.id,
      zone_id: sosVisit.zone_id,
      message: 'Car will not start',
      raised_by_driver: sosVisit.driver_id,
      created_at: iso(new Date(sosVisit.checked_in_at).getTime() + 30 * 60_000),
    })
  const zoneA = zones.find((z) => z.code === 'A') ?? zones[0]
  if (zoneA) {
    const ring = zoneA.area.coordinates[0]
    const inside: [number, number] = [(ring[0][0] + ring[2][0]) / 2, (ring[0][1] + ring[2][1]) / 2]
    insertAlert(db, {
      event_id: ev.id,
      type: 'wrong_parking',
      zone_id: zoneA.id,
      message: 'Blocking a road',
      location: inside,
      raised_by_profile: zoneUser.id,
      created_at: iso(now - 7 * 60_000),
    })
  }
  // Keep the reference to the nearest gate helper for future tuning.
  void distM
  return added
}

/** Reset: back to the seed. Staff sessions stay valid because seed ids are fixed. */
export function resetDemoData(): void {
  clearPhotos()
  replaceDb(buildSeed().db)
}

/** Places the simulated GPS can jump to: the live event's first gate and, for a driver tab, their slot. */
export function demoPlaces(): { gate: [number, number] | null; mySlot: [number, number] | null } {
  const db = readDb()
  const ev = db.events.find((e) => e.status === 'live')
  const gate = ev ? (db.gates.filter((g) => g.event_id === ev.id).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null) : null
  const session = getSession()
  let mySlot: [number, number] | null = null
  if (session?.role === 'driver') {
    const v = db.visits
      .filter((x) => x.driver_id === session.driverId && isActive(x.status))
      .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))[0]
    const s = v?.slot_id ? db.slots.find((x) => x.id === v.slot_id) : undefined
    if (s) mySlot = s.center
  }
  return { gate: gate?.location ?? null, mySlot }
}
