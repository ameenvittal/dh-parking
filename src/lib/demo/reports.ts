import { formatInTimeZone } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/config/app'
import { AppError } from '@/lib/errors'
import { PAYMENT_METHODS, VEHICLE_TYPES, VISITOR_CATEGORIES } from '@/types/domain'
import type { EventRow, VehicleType, VisitRow, VisitorCategory } from '@/types/domain'
import { eventById, latestWaStatus, requireRole } from './core'
import { readDb, type DemoDb } from './db'
import type {
  ExportAlertRow,
  ExportVisitRow,
  OccupancyReport,
  PeakHoursReport,
  ReportFilters,
  ReportZoneInfo,
  RevenueReport,
  VehicleCountsReport,
} from './types'

/**
 * Report RPCs from docs/09. Admin only. Buckets are aligned in Asia/Kolkata (UTC+5:30)
 * and returned as ISO strings with the +05:30 offset.
 */

const IST_OFFSET_MS = 330 * 60_000

type Ctx = { db: DemoDb; ev: EventRow; from: number; to: number; interval: number; zoneIds: string[] | null; visits: VisitRow[] }

function ctx(f: ReportFilters): Ctx {
  const db = readDb()
  requireRole(db, ['admin'])
  const ev = eventById(db, f.eventId)
  const defFrom = new Date(ev.starts_at).getTime() - 3 * 3600_000
  const defTo = Math.min(Date.now(), new Date(ev.ends_at).getTime() + 6 * 3600_000)
  const from = f.from ? new Date(f.from).getTime() : defFrom
  const to = f.to ? new Date(f.to).getTime() : defTo
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw new AppError('BAD_REQUEST')
  const zoneIds = f.zoneIds && f.zoneIds.length > 0 ? f.zoneIds : null
  const visits = db.visits.filter((v) => v.event_id === ev.id && (!zoneIds || zoneIds.includes(v.zone_id ?? '')))
  return { db, ev, from, to, interval: (f.intervalMin ?? 15) * 60_000, zoneIds, visits }
}

export function binStart(t: number, interval: number): number {
  return Math.floor((t + IST_OFFSET_MS) / interval) * interval - IST_OFFSET_MS
}

export function istIso(t: number): string {
  return formatInTimeZone(new Date(t), APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null)

function inRange(c: Ctx, iso: string): boolean {
  const t = new Date(iso).getTime()
  return t >= c.from && t <= c.to
}

function zonesOf(c: Ctx): ReportZoneInfo[] {
  return c.db.zones
    .filter((z) => z.event_id === c.ev.id && (!c.zoneIds || c.zoneIds.includes(z.id)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((z) => {
      const slots = c.db.slots.filter((s) => s.zone_id === z.id)
      return {
        zone_id: z.id,
        code: z.code,
        name: z.name,
        color: z.color,
        capacity: slots.length - slots.filter((s) => s.status === 'blocked').length,
      }
    })
}

/* ------------------------------------------------------------- occupancy */

export function reportOccupancy(f: ReportFilters): OccupancyReport {
  const c = ctx(f)
  const zones = zonesOf(c)
  const now = Date.now()
  const counted = c.visits.filter((v) => v.status !== 'cancelled')
  const intervals = counted.map((v) => {
    const parkedStart = ms(v.driver_parked_at) ?? ms(v.confirmed_at)
    const end = ms(v.exited_at) ?? ms(v.cancelled_at) ?? now
    return { zone: v.zone_id, parkedStart, holdStart: ms(v.checked_in_at)!, end }
  })
  const series: OccupancyReport['series'] = []
  const totalCap = zones.reduce((s, z) => s + z.capacity, 0)
  const pct = (n: number, cap: number) => (cap > 0 ? Math.round((1000 * n) / cap) / 10 : 0)
  for (let t = binStart(c.from, c.interval); t <= c.to; t += c.interval) {
    const values: OccupancyReport['series'][number]['values'] = {}
    let tp = 0
    let th = 0
    zones.forEach((z) => {
      let parked = 0
      let holding = 0
      intervals.forEach((iv) => {
        if (iv.zone !== z.zone_id) return
        if (iv.parkedStart != null && iv.parkedStart <= t && t < iv.end) parked += 1
        if (iv.holdStart <= t && t < iv.end) holding += 1
      })
      tp += parked
      th += holding
      values[z.zone_id] = { parked, holding, pct: pct(parked, z.capacity) }
    })
    series.push({ t: istIso(t), values, total: { parked: tp, holding: th, pct: pct(tp, totalCap) } })
  }
  const peaks = zones.map((z) => {
    let best: { max_pct: number; at: string | null } = { max_pct: 0, at: null }
    series.forEach((s) => {
      const p = s.values[z.zone_id]?.pct ?? 0
      if (p > best.max_pct) best = { max_pct: p, at: s.t }
    })
    return { zone_id: z.zone_id, ...best }
  })
  return { interval_min: c.interval / 60_000, from: istIso(c.from), to: istIso(c.to), zones, series, peaks }
}

/* ------------------------------------------------------------- peak hours */

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function reportPeakHours(f: ReportFilters): PeakHoursReport {
  const c = ctx(f)
  const buckets: number[] = []
  for (let t = binStart(c.from, c.interval); t <= c.to; t += c.interval) buckets.push(t)
  const idx = (iso: string | null) => {
    if (!iso) return -1
    const t = new Date(iso).getTime()
    if (t < c.from || t > c.to) return -1
    return Math.floor((binStart(t, c.interval) - buckets[0]) / c.interval)
  }
  const counted = c.visits.filter((v) => v.status !== 'cancelled')
  const arrivals = buckets.map(() => 0)
  const exits = buckets.map(() => 0)
  const gates = c.db.gates.filter((g) => g.event_id === c.ev.id).sort((a, b) => a.sort_order - b.sort_order)
  const byGate = gates.map((g) => ({
    gate_id: g.id,
    name: g.name,
    arrivals: buckets.map(() => 0),
    exits: buckets.map(() => 0),
  }))
  counted.forEach((v) => {
    const a = idx(v.checked_in_at)
    if (a >= 0 && a < buckets.length) {
      arrivals[a] += 1
      const g = byGate.find((x) => x.gate_id === v.entry_gate_id)
      if (g) g.arrivals[a] += 1
    }
    const e = idx(v.exited_at)
    if (e >= 0 && e < buckets.length) {
      exits[e] += 1
      const g = byGate.find((x) => x.gate_id === v.exit_gate_id)
      if (g) g.exits[e] += 1
    }
  })
  const series = buckets.map((t, i) => ({ t: istIso(t), arrivals: arrivals[i], exits: exits[i] }))
  const busiest = (key: 'arrivals' | 'exits') => {
    let best: { t: string; count: number } | null = null
    series.forEach((s) => {
      if (s[key] > 0 && (!best || s[key] > best.count)) best = { t: s.t, count: s[key] }
    })
    return best
  }
  const inWindow = counted.filter((v) => inRange(c, v.checked_in_at))
  const checkin = median(inWindow.map((v) => v.checkin_duration_ms).filter((n): n is number => n != null))
  const confirm = median(
    inWindow
      .filter((v) => v.confirmed_at)
      .map((v) => (new Date(v.confirmed_at!).getTime() - new Date(v.checked_in_at).getTime()) / 60_000),
  )
  return {
    interval_min: c.interval / 60_000,
    series,
    by_gate: byGate,
    busiest_arrival: busiest('arrivals'),
    busiest_exit: busiest('exits'),
    median_checkin_seconds: checkin == null ? null : Math.round(checkin / 1000),
    median_time_to_confirm_minutes: confirm == null ? null : Math.round(confirm * 10) / 10,
  }
}

/* ------------------------------------------------------------- revenue */

export function reportRevenue(f: ReportFilters): RevenueReport {
  const c = ctx(f)
  const rows = c.visits.filter((v) => v.status !== 'cancelled' && inRange(c, v.checked_in_at))
  const paid = rows.filter((v) => v.payment_method !== 'free' && v.fee_amount > 0)
  const sum = (list: VisitRow[]) => list.reduce((s, v) => s + v.fee_amount, 0)
  const days = new Map<string, VisitRow[]>()
  rows.forEach((v) => {
    const d = formatInTimeZone(new Date(v.checked_in_at), APP_TIMEZONE, 'yyyy-MM-dd')
    days.set(d, [...(days.get(d) ?? []), v])
  })
  return {
    paid_parking: c.ev.paid_parking,
    total: sum(rows),
    count_paid: paid.length,
    count_free: rows.length - paid.length,
    by_zone: zonesOf(c).map((z) => {
      const list = rows.filter((v) => v.zone_id === z.zone_id)
      return { zone_id: z.zone_id, code: z.code, name: z.name, amount: sum(list), count: list.length }
    }),
    by_day: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({ date, amount: sum(list), count: list.length })),
    by_method: PAYMENT_METHODS.map((m) => {
      const list = rows.filter((v) => v.payment_method === m)
      return { method: m, amount: sum(list), count: list.length }
    }),
    by_vehicle_type: VEHICLE_TYPES.map((t) => {
      const list = rows.filter((v) => v.vehicle_type === t)
      return { type: t, amount: sum(list), count: list.length }
    }).filter((r) => r.count > 0),
  }
}

/* ------------------------------------------------------------- vehicle counts */

export function reportVehicleCounts(f: ReportFilters): VehicleCountsReport {
  const c = ctx(f)
  const rows = c.visits.filter((v) => v.status !== 'cancelled' && inRange(c, v.checked_in_at))
  const ids = new Set(rows.map((v) => v.id))
  const matrix = VISITOR_CATEGORIES.map((cat) => {
    const list = rows.filter((v) => v.category === cat)
    const row = { category: cat, total: list.length } as { category: VisitorCategory; total: number } & Record<
      VehicleType,
      number
    >
    VEHICLE_TYPES.forEach((t) => (row[t] = list.filter((v) => v.vehicle_type === t).length))
    return row
  }).filter((r) => r.total > 0)
  const photos = rows.filter((v) => v.photo_path || v.ai_plate_confidence != null)
  const edited = photos.filter((v) => v.ai_edited).length
  const msgs = c.db.whatsapp_messages.filter((m) => m.visit_id && ids.has(m.visit_id))
  const alerts = c.db.alerts.filter((a) => a.visit_id && ids.has(a.visit_id))
  return {
    total: rows.length,
    by_category: VISITOR_CATEGORIES.map((cat) => ({ category: cat, count: rows.filter((v) => v.category === cat).length }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count),
    by_type: VEHICLE_TYPES.map((t) => ({ type: t, count: rows.filter((v) => v.vehicle_type === t).length }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count),
    matrix,
    by_zone: zonesOf(c).map((z) => ({
      zone_id: z.zone_id,
      code: z.code,
      name: z.name,
      count: rows.filter((v) => v.zone_id === z.zone_id).length,
    })),
    accessible: rows.filter((v) => v.needs_accessible).length,
    ai: {
      photos: photos.length,
      plate_edited: edited,
      accuracy_pct: photos.length > 0 ? Math.round((1000 * (photos.length - edited)) / photos.length) / 10 : null,
    },
    whatsapp: {
      sent: msgs.filter((m) => m.status !== 'failed' && m.status !== 'queued').length,
      failed: msgs.filter((m) => m.status === 'failed').length,
    },
    confirmation: {
      confirmed: rows.filter((v) => v.confirmed_at).length,
      wrong_slot: alerts.filter((a) => a.type === 'wrong_slot').length,
      location_mismatch: alerts.filter((a) => a.type === 'location_mismatch').length,
    },
  }
}

/* ------------------------------------------------------------- exports */

export function exportVisits(f: ReportFilters): ExportVisitRow[] {
  const c = ctx(f)
  const { db } = c
  const name = (list: { id: string; name: string }[], id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? null) : null
  return c.visits
    .filter((v) => inRange(c, v.checked_in_at))
    .sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at))
    .map((v) => {
      const d = db.drivers.find((x) => x.id === v.driver_id)
      return {
        plate: v.plate,
        vehicle_type: v.vehicle_type,
        vehicle_color: v.vehicle_color,
        vehicle_make: v.vehicle_make,
        category: v.category,
        pass_number: v.pass_number,
        pass_holder_name: v.pass_holder_name,
        needs_accessible: v.needs_accessible,
        phone: d?.phone_e164 ?? '',
        driver_name: d?.name ?? null,
        entry_gate: name(db.gates, v.entry_gate_id),
        checked_in_at: v.checked_in_at,
        slot: v.slot_id ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? null) : null,
        zone: name(db.zones, v.zone_id),
        status: v.status,
        link_opened_at: v.link_opened_at,
        driver_parked_at: v.driver_parked_at,
        driver_parked_distance_m: v.driver_parked_distance_m,
        confirmed_at: v.confirmed_at,
        confirmed_by: v.confirmed_by
          ? (db.profiles.find((p) => p.id === v.confirmed_by)?.full_name ?? null)
          : null,
        exited_at: v.exited_at,
        exit_gate: name(db.gates, v.exit_gate_id),
        fee_amount: v.fee_amount,
        payment_method: v.payment_method,
        ai_plate_confidence: v.ai_plate_confidence,
        ai_edited: v.ai_edited,
        wa_status: latestWaStatus(db, v.id),
      }
    })
}

export function exportAlerts(f: ReportFilters): ExportAlertRow[] {
  const c = ctx(f)
  const { db } = c
  return db.alerts
    .filter(
      (a) =>
        a.event_id === c.ev.id && inRange(c, a.created_at) && (!c.zoneIds || c.zoneIds.includes(a.zone_id ?? '')),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((a) => ({
      type: a.type,
      status: a.status,
      plate: a.visit_id ? (db.visits.find((v) => v.id === a.visit_id)?.plate ?? null) : null,
      zone: a.zone_id ? (db.zones.find((z) => z.id === a.zone_id)?.name ?? null) : null,
      raised_by: a.raised_by_driver
        ? 'Driver'
        : a.raised_by_profile
          ? (db.profiles.find((p) => p.id === a.raised_by_profile)?.full_name ?? 'Staff')
          : 'System',
      created_at: a.created_at,
      resolved_at: a.resolved_at,
      note: a.resolution_note,
    }))
}
