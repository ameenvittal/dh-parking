import { APP_URL } from '@/config/app'
import { AppError } from '@/lib/errors'
import { formatPlate } from '@/lib/format'
import { normalizeIndianPhone } from '@/lib/phone'
import type {
  CheckinInput,
  CheckinResult,
  DriverRow,
  Language,
  ProfileRow,
  Session,
  VisitRow,
  WaMessageRow,
} from '@/types/domain'
import { eventById, isActive, logVisitEvent, newId, requireRole, visitById } from './core'
import { mutate, nowIso, readDb, type DemoDb } from './db'
import { assignNewVisit, raiseSosCore, reassignVisitCore } from './rpc'
import { clearSession, setSession } from './session'
import { createToken, hashToken } from './tokens'
import type {
  DriverTokenResult,
  RaiseSosInput,
  ReassignInput,
  ReassignResult,
  ResendResult,
  SosResult,
  StaffActionInput,
  StaffActionResult,
  TestMessageInput,
  TestMessageResult,
} from './types'
import { driverLink, guestName, sendTemplate } from './whatsapp'

/* ------------------------------------------------------------- helpers */

/** hit_rate_limit(key, max, window). Returns false when over the limit. */
function hitRateLimit(db: DemoDb, key: string, max: number, windowSeconds: number): boolean {
  const now = Date.now()
  const row = db.rate_limits[key]
  if (!row || now - row.window_start > windowSeconds * 1000) {
    db.rate_limits[key] = { window_start: now, count: 1 }
    return true
  }
  row.count += 1
  return row.count <= max
}

/** Counts the hit in its own write so it sticks even when the call then fails. */
function rateLimit(key: string, max: number, windowSeconds: number): void {
  const ok = mutate((db) => hitRateLimit(db, key, max, windowSeconds))
  if (!ok) throw new AppError('RATE_LIMITED')
}

function tokenExpiry(db: DemoDb, eventId: string): string {
  const ev = eventById(db, eventId)
  return new Date(new Date(ev.ends_at).getTime() + 6 * 3600_000).toISOString()
}

function insertToken(db: DemoDb, driverId: string, eventId: string, hash: string): void {
  db.driver_access_tokens.push({
    id: newId(),
    driver_id: driverId,
    token_hash: hash,
    expires_at: tokenExpiry(db, eventId),
    revoked_at: null,
    last_used_at: null,
    use_count: 0,
    created_at: nowIso(),
  })
}

function localZoneName(db: DemoDb, zoneId: string | null, lang: Language): string {
  const z = zoneId ? db.zones.find((x) => x.id === zoneId) : undefined
  if (!z) return '-'
  return lang === 'ml' && z.name_ml ? z.name_ml : z.name
}

function slotLabel(db: DemoDb, slotId: string | null): string {
  return (slotId ? db.slots.find((s) => s.id === slotId)?.label : null) ?? '-'
}

/** Sends parking_login_link for a visit with a fresh token. Existing tokens stay valid. */
function sendLoginLink(db: DemoDb, visit: VisitRow, driver: DriverRow, rawToken: string, hash: string): WaMessageRow {
  const ev = eventById(db, visit.event_id)
  insertToken(db, driver.id, ev.id, hash)
  return sendTemplate(db, {
    event_id: ev.id,
    driver_id: driver.id,
    visit_id: visit.id,
    to: driver.phone_e164,
    template: 'parking_login_link',
    language: driver.preferred_language,
    params: [ev.name, slotLabel(db, visit.slot_id)],
    buttonUrl: driverLink(rawToken),
  })
}

/* ------------------------------------------------------------- auth */

export function staffSignIn(usernameInput: string, password: string): Session {
  const username = usernameInput.trim().toLowerCase()
  const profile = readDb().profiles.find((p) => p.username === username)
  if (!profile || profile.password !== password) throw new AppError('BAD_CREDENTIALS')
  if (!profile.is_active) throw new AppError('ACCOUNT_OFF')
  mutate((db, touch) => {
    const p = db.profiles.find((x) => x.id === profile.id)
    if (p) p.last_seen_at = nowIso()
    touch('profiles')
  })
  const session: Session = {
    role: profile.role,
    userId: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    zoneIds: profile.zone_ids,
    gateIds: profile.gate_ids,
    driverId: null,
    eventId: null,
    language: profile.preferred_language,
    expiresAt: null,
  }
  setSession(session)
  return session
}

export function signOut(): void {
  clearSession()
}

/** driver-login: validates the token hash and signs this tab in as the driver. */
export async function driverLogin(rawToken: string): Promise<DriverTokenResult> {
  const hash = await hashToken(rawToken.trim())
  rateLimit('driver-login:local', 20, 600)
  const { session, result } = mutate((db, touch) => {
    const now = Date.now()
    const tok = db.driver_access_tokens.find((t) => t.token_hash === hash)
    if (!tok || tok.revoked_at || new Date(tok.expires_at).getTime() <= now) throw new AppError('TOKEN_INVALID')
    const driver = db.drivers.find((d) => d.id === tok.driver_id)
    if (!driver) throw new AppError('TOKEN_INVALID')
    tok.last_used_at = new Date(now).toISOString()
    tok.use_count += 1
    const visit = db.visits
      .filter((v) => v.driver_id === driver.id && isActive(v.status))
      .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))[0]
    if (visit && !visit.link_opened_at) {
      visit.link_opened_at = nowIso()
      logVisitEvent(db, visit, 'link_opened', {}, { role: 'driver', id: driver.id })
      touch('visits')
    }
    const s: Session = {
      role: 'driver',
      userId: driver.id,
      fullName: driver.name ?? '',
      username: null,
      zoneIds: [],
      gateIds: [],
      driverId: driver.id,
      eventId: driver.event_id,
      language: driver.preferred_language,
      expiresAt: tok.expires_at,
    }
    return { session: s, result: { event_id: driver.event_id, language: driver.preferred_language } }
  })
  setSession(session)
  return result
}

/** driver-resend-link: always `{ ok: true }` so numbers cannot be enumerated. */
export async function driverResendLink(phoneInput: string): Promise<{ ok: true }> {
  const phone = normalizeIndianPhone(phoneInput)
  if (!phone) throw new AppError('INVALID_PHONE')
  const token = await createToken()
  rateLimit(`resend:phone:${phone}`, 3, 3600)
  rateLimit('resend:ip:local', 20, 3600)
  mutate((db, touch) => {
    const ev = db.events.find((e) => e.status === 'live')
    if (!ev) return
    const now = Date.now()
    for (const driver of db.drivers.filter((d) => d.event_id === ev.id && d.phone_e164 === phone)) {
      const visit = db.visits
        .filter(
          (v) =>
            v.driver_id === driver.id &&
            (isActive(v.status) ||
              (v.status === 'exited' && v.exited_at && now - new Date(v.exited_at).getTime() < 12 * 3600_000)),
        )
        .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))[0]
      if (visit) {
        sendLoginLink(db, visit, driver, token.raw, token.hash)
        touch('whatsapp_messages')
        return
      }
    }
  })
  return { ok: true }
}

/** Gate or admin "Resend link" for one visit (driver-resend-link with the visit's phone). */
export async function resendForVisit(visitId: string): Promise<ResendResult> {
  const token = await createToken()
  return mutate((db, touch) => {
    requireRole(db, ['gate_volunteer', 'admin'])
    const visit = visitById(db, visitId)
    if (!isActive(visit.status)) throw new AppError('INVALID_STATE')
    const driver = db.drivers.find((d) => d.id === visit.driver_id)
    if (!driver) throw new AppError('NOT_FOUND')
    const msg = sendLoginLink(db, visit, driver, token.raw, token.hash)
    touch('whatsapp_messages')
    return { ok: true as const, message_id: msg.id, status: msg.status }
  })
}

/* ------------------------------------------------------------- gate-checkin */

export async function gateCheckin(input: CheckinInput): Promise<CheckinResult> {
  const token = await createToken()
  return mutate((db, touch) => {
    const caller = requireRole(db, ['gate_volunteer', 'admin'])
    const role = caller.session.role
    const gateIds = caller.profile?.gate_ids ?? []
    if (role === 'gate_volunteer' && gateIds.length > 0 && !gateIds.includes(input.gate_id))
      throw new AppError('FORBIDDEN')
    const phone = normalizeIndianPhone(input.phone)
    if (!phone) throw new AppError('INVALID_PHONE')
    const ev = eventById(db, input.event_id)
    if (ev.status !== 'live') throw new AppError('NO_LIVE_EVENT')
    const allowDuplicate = input.allow_duplicate && role === 'admin'

    let fee = Math.max(0, Number(input.fee_amount) || 0)
    let method = input.payment_method
    if (!ev.paid_parking || ev.fee_exempt_categories.includes(input.category) || method === 'free') {
      fee = 0
      method = 'free'
    }

    let driver = db.drivers.find((d) => d.event_id === ev.id && d.phone_e164 === phone)
    if (!driver) {
      driver = {
        id: newId(),
        event_id: ev.id,
        phone_e164: phone,
        name: null,
        preferred_language: input.language,
        location_consent_at: null,
        created_at: nowIso(),
      }
      db.drivers.push(driver)
    }
    if (input.driver_name?.trim()) driver.name = input.driver_name.trim()
    driver.preferred_language = input.language

    const visit = assignNewVisit(db, {
      event_id: ev.id,
      driver_id: driver.id,
      actor: caller.actor,
      gate_id: input.gate_id,
      slot_id: input.slot_id,
      plate_raw: input.plate_raw.trim(),
      vehicle_type: input.vehicle_type,
      vehicle_color: input.vehicle_color?.trim() || null,
      vehicle_make: input.vehicle_make?.trim() || null,
      category: input.category,
      pass_number: input.pass_number?.trim() || null,
      pass_holder_name: input.pass_holder_name?.trim() || null,
      needs_accessible: input.needs_accessible,
      photo_path: input.photo_path,
      ai_result: input.ai_result,
      ai_plate_confidence: input.ai_plate_confidence,
      ai_edited: input.ai_edited,
      fee_amount: fee,
      payment_method: method,
      allow_duplicate: allowDuplicate,
      checkin_duration_ms: input.checkin_duration_ms,
    })

    insertToken(db, driver.id, ev.id, token.hash)
    const link = driverLink(token.raw)
    const slot = db.slots.find((s) => s.id === visit.slot_id)!
    const zone = db.zones.find((z) => z.id === visit.zone_id)!
    const lang = driver.preferred_language
    const msg = sendTemplate(db, {
      event_id: ev.id,
      driver_id: driver.id,
      visit_id: visit.id,
      to: phone,
      template: 'parking_slot_assigned',
      language: lang,
      params: [
        driver.name ?? guestName(lang),
        ev.name,
        slot.label,
        localZoneName(db, zone.id, lang),
        formatPlate(visit.plate),
      ],
      buttonUrl: link,
    })
    touch('visits', 'slots', 'whatsapp_messages')
    return {
      visit_id: visit.id,
      slot: { id: slot.id, label: slot.label, zone_code: zone.code, zone_name: zone.name, zone_name_ml: zone.name_ml },
      link,
      whatsapp: { message_id: msg.id, status: msg.status, error: null },
    }
  })
}

/* ------------------------------------------------------------- visit-reassign */

export async function visitReassign(input: ReassignInput): Promise<ReassignResult> {
  const token = await createToken()
  return mutate((db, touch) => {
    const caller = requireRole(db, ['gate_volunteer', 'admin'])
    const v = reassignVisitCore(db, input.visitId, input.newSlotId, caller)
    const slot = db.slots.find((s) => s.id === v.slot_id)!
    const zone = db.zones.find((z) => z.id === v.zone_id)!
    let whatsapp: ReassignResult['whatsapp'] = { message_id: '', status: 'failed', error: 'not_sent' }
    if (input.notify) {
      const driver = db.drivers.find((d) => d.id === v.driver_id)
      const ev = eventById(db, v.event_id)
      if (driver) {
        insertToken(db, driver.id, ev.id, token.hash)
        const lang = driver.preferred_language
        const msg = sendTemplate(db, {
          event_id: ev.id,
          driver_id: driver.id,
          visit_id: v.id,
          to: driver.phone_e164,
          template: 'parking_slot_changed',
          language: lang,
          params: [ev.name, slot.label, localZoneName(db, zone.id, lang)],
          buttonUrl: driverLink(token.raw),
        })
        whatsapp = { message_id: msg.id, status: msg.status, error: null }
      }
    }
    touch('visits', 'slots', 'alerts', 'whatsapp_messages')
    return {
      slot: { id: slot.id, label: slot.label, zone_code: zone.code, zone_name: zone.name, zone_name_ml: zone.name_ml },
      whatsapp,
    }
  })
}

/* ------------------------------------------------------------- SOS + alert-dispatch */

const SOS_REASON_EN: Record<RaiseSosInput['reason'], string> = {
  medical: 'Medical',
  breakdown: 'Vehicle breakdown',
  safety: 'Safety',
  lost: 'Lost',
  other: 'Other',
}

export function raiseSos(input: RaiseSosInput): SosResult {
  return mutate((db, touch) => {
    const caller = requireRole(db, ['driver'])
    const { alert, created, emergency_phone } = raiseSosCore(db, caller, input)
    if (created) {
      const ev = eventById(db, alert.event_id)
      const visit = alert.visit_id ? db.visits.find((v) => v.id === alert.visit_id) : undefined
      const driver = db.drivers.find((d) => d.id === alert.raised_by_driver)
      for (const to of ev.admin_alert_phones) {
        sendTemplate(db, {
          event_id: ev.id,
          driver_id: null,
          visit_id: null,
          to,
          template: 'sos_admin_alert',
          language: 'en',
          params: [
            ev.name,
            SOS_REASON_EN[input.reason],
            visit ? formatPlate(visit.plate) : 'unknown vehicle',
            visit ? slotLabel(db, visit.slot_id) : 'no slot',
            driver?.phone_e164 ?? 'unknown',
          ],
          buttonUrl: `${APP_URL}/admin/alerts?id=${alert.id}`,
        })
      }
      touch('alerts', 'visits', 'whatsapp_messages')
    }
    return { alert_id: alert.id, emergency_phone }
  })
}

/* ------------------------------------------------------------- admin-staff */

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/

export function adminStaff(input: StaffActionInput): StaffActionResult {
  return mutate((db, touch) => {
    const caller = requireRole(db, ['admin'])
    const find = (id: string): ProfileRow => {
      const p = db.profiles.find((x) => x.id === id)
      if (!p) throw new AppError('NOT_FOUND')
      return p
    }
    const cleanPhone = (phone: string | null) => {
      if (!phone || !phone.trim()) return null
      const p = normalizeIndianPhone(phone)
      if (!p) throw new AppError('INVALID_PHONE')
      return p
    }
    touch('profiles')
    switch (input.action) {
      case 'create': {
        const username = input.username.trim().toLowerCase()
        if (!USERNAME_RE.test(username) || !input.full_name.trim() || input.password.length < 8)
          throw new AppError('BAD_REQUEST')
        if (db.profiles.some((p) => p.username === username)) throw new AppError('USERNAME_TAKEN')
        const row: ProfileRow = {
          id: newId(),
          role: input.role,
          full_name: input.full_name.trim(),
          username,
          password: input.password,
          phone: cleanPhone(input.phone),
          zone_ids: input.role === 'zone_volunteer' ? input.zone_ids : [],
          gate_ids: input.role === 'gate_volunteer' ? input.gate_ids : [],
          preferred_language: 'en',
          is_active: true,
          last_seen_at: null,
          created_at: nowIso(),
        }
        db.profiles.push(row)
        return { ok: true as const, id: row.id }
      }
      case 'update': {
        const p = find(input.id)
        if (!input.full_name.trim()) throw new AppError('BAD_REQUEST')
        if (p.id === caller.actor.id && input.role !== 'admin') throw new AppError('FORBIDDEN')
        p.full_name = input.full_name.trim()
        p.role = input.role
        p.phone = cleanPhone(input.phone)
        p.zone_ids = input.role === 'zone_volunteer' ? input.zone_ids : []
        p.gate_ids = input.role === 'gate_volunteer' ? input.gate_ids : []
        p.preferred_language = input.preferred_language
        return { ok: true as const, id: p.id }
      }
      case 'deactivate': {
        const p = find(input.id)
        if (p.id === caller.actor.id) throw new AppError('FORBIDDEN')
        p.is_active = false
        return { ok: true as const, id: p.id }
      }
      case 'activate': {
        const p = find(input.id)
        p.is_active = true
        return { ok: true as const, id: p.id }
      }
      case 'reset_password': {
        const p = find(input.id)
        if (input.password.length < 8) throw new AppError('BAD_REQUEST')
        p.password = input.password
        return { ok: true as const, id: p.id }
      }
    }
  })
}

/* ------------------------------------------------------------- settings: WhatsApp test */

export function sendTestMessage(input: TestMessageInput): TestMessageResult {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const phone = normalizeIndianPhone(input.phone)
    if (!phone) throw new AppError('INVALID_PHONE')
    const ev = db.events.find((e) => e.status === 'live') ?? db.events[0]
    if (!ev) throw new AppError('NO_LIVE_EVENT')
    const lang = input.language
    const params: Record<typeof input.template, string[]> = {
      parking_slot_assigned: [guestName(lang), ev.name, 'A-012', lang === 'ml' ? 'വടക്കേ പുൽത്തകിടി' : 'North lawn', 'KL 02 AB 1234'],
      parking_login_link: [ev.name, 'A-012'],
      parking_slot_changed: [ev.name, 'B-004', lang === 'ml' ? 'ബൈക്ക് പാർക്ക്' : 'Bike park'],
      sos_admin_alert: [ev.name, 'Test', 'KL 02 AB 1234', 'A-012', '+91 98765 43210'],
    }
    const msg = sendTemplate(db, {
      event_id: ev.id,
      driver_id: null,
      visit_id: null,
      to: phone,
      template: input.template,
      language: lang,
      params: params[input.template],
      buttonUrl: driverLink('test'),
    })
    touch('whatsapp_messages')
    return { message_id: msg.id, status: msg.status, error: null }
  })
}
