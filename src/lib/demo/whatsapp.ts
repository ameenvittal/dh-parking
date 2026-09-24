import { APP_URL } from '@/config/app'
import { AppError } from '@/lib/errors'
import { formatPlate } from '@/lib/format'
import { normalizeIndianPhone } from '@/lib/phone'
import type { Language, VisitRow, WaMessageRow, WaStatus, WaTemplate } from '@/types/domain'
import { isActive, logVisitEvent, newId } from './core'
import { mutate, nowIso, readDb, type DemoDb } from './db'
import { createToken } from './tokens'
import type { SimChat, SimMessage } from './types'

/**
 * Simulated WhatsApp Cloud API (docs/08 section 2). Messages are rendered from the
 * approved template text, stored as whatsapp_messages rows, then advanced by a ticker:
 * queued, sent (about 0.6 s), delivered (about 2 s), read (when opened in the simulator).
 * Numbers ending in 00 fail with Meta error 131026 so the QR fallback can be tested.
 */

const SENT_AFTER_MS = 600
const DELIVERED_AFTER_MS = 2000

const TEMPLATES: Record<WaTemplate, Record<Language, { body: string; button: string }>> = {
  parking_slot_assigned: {
    en: {
      body: 'Hi {{1}}, your parking slot for {{2}} is {{3}} in {{4}}.\nVehicle: {{5}}\nTap the button below for the map and directions. Keep the page open while you drive.',
      button: 'Open parking map',
    },
    ml: {
      body: 'നമസ്കാരം {{1}}, {{2}} പരിപാടിക്കുള്ള നിങ്ങളുടെ പാർക്കിംഗ് സ്ലോട്ട് {{4}} ഭാഗത്തെ {{3}} ആണ്.\nവാഹനം: {{5}}\nമാപ്പും വഴിയും കാണാൻ താഴെയുള്ള ബട്ടൺ അമർത്തുക. വാഹനം ഓടിക്കുമ്പോൾ പേജ് തുറന്നുവെക്കുക.',
      button: 'പാർക്കിംഗ് മാപ്പ് തുറക്കുക',
    },
  },
  parking_login_link: {
    en: {
      body: 'Here is your parking link for {{1}}. Your slot is {{2}}.\nTap the button below to open the map.',
      button: 'Open parking map',
    },
    ml: {
      body: '{{1}} പരിപാടിയുടെ പാർക്കിംഗ് ലിങ്ക് ഇതാ. നിങ്ങളുടെ സ്ലോട്ട് {{2}} ആണ്.\nമാപ്പ് തുറക്കാൻ താഴെയുള്ള ബട്ടൺ അമർത്തുക.',
      button: 'പാർക്കിംഗ് മാപ്പ് തുറക്കുക',
    },
  },
  parking_slot_changed: {
    en: {
      body: 'Your parking slot for {{1}} has changed. New slot: {{2}} in {{3}}.\nTap the button below for directions.',
      button: 'Open parking map',
    },
    ml: {
      body: '{{1}} പരിപാടിയിലെ നിങ്ങളുടെ പാർക്കിംഗ് സ്ലോട്ട് മാറി. പുതിയ സ്ലോട്ട്: {{3}} ഭാഗത്തെ {{2}}.\nവഴി കാണാൻ താഴെയുള്ള ബട്ടൺ അമർത്തുക.',
      button: 'പാർക്കിംഗ് മാപ്പ് തുറക്കുക',
    },
  },
  sos_admin_alert: {
    en: {
      body: 'SOS at {{1}}: {{2}}.\nVehicle {{3}}, slot {{4}}. Driver phone {{5}}.\nOpen the alerts page to respond.',
      button: 'Open alerts',
    },
    ml: {
      body: 'SOS at {{1}}: {{2}}.\nVehicle {{3}}, slot {{4}}. Driver phone {{5}}.\nOpen the alerts page to respond.',
      button: 'Open alerts',
    },
  },
}

export function renderTemplate(
  template: WaTemplate,
  language: Language,
  params: string[],
): { body: string; button: string } {
  const lang: Language = template === 'sos_admin_alert' ? 'en' : language
  const t = TEMPLATES[template][lang]
  const body = t.body.replace(/\{\{(\d)\}\}/g, (_, n: string) => {
    const v = params[Number(n) - 1]
    if (!v) throw new AppError('WA_FAILED', '132000')
    return v
  })
  return { body, button: t.button }
}

export function guestName(language: Language): string {
  return language === 'ml' ? 'അതിഥി' : 'Guest'
}

export function driverLink(rawToken: string): string {
  return `${APP_URL}/d/${rawToken}`
}

export type SendArgs = {
  event_id: string
  driver_id: string | null
  visit_id: string | null
  to: string
  template: WaTemplate
  language: Language
  params: string[]
  /** Full URL behind the template button. */
  buttonUrl: string
}

/** Inserts a queued message row. The ticker moves it to sent or failed. */
export function sendTemplate(db: DemoDb, a: SendArgs): WaMessageRow {
  const { body, button } = renderTemplate(a.template, a.language, a.params)
  const now = nowIso()
  const row: WaMessageRow = {
    id: newId(),
    event_id: a.event_id,
    driver_id: a.driver_id,
    visit_id: a.visit_id,
    template: a.template,
    language: a.template === 'sos_admin_alert' ? 'en' : a.language,
    to_phone: a.to,
    wa_message_id: `wamid.demo.${newId().replace(/-/g, '')}`,
    status: 'queued',
    error_code: null,
    error_title: null,
    body,
    button_label: button,
    button_url: a.buttonUrl,
    created_at: now,
    updated_at: now,
  }
  db.whatsapp_messages.push(row)
  return row
}

function willFail(phone: string): boolean {
  return phone.replace(/\D/g, '').endsWith('00')
}

const ORDER: Record<WaStatus, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 9 }

function targetStatus(db: DemoDb, m: WaMessageRow, now: number): WaStatus {
  if (m.status === 'failed' || m.status === 'read') return m.status
  const age = now - new Date(m.created_at).getTime()
  if (age < SENT_AFTER_MS) return m.status
  if (willFail(m.to_phone)) return 'failed'
  if (age < DELIVERED_AFTER_MS) return ORDER[m.status] >= ORDER.sent ? m.status : 'sent'
  const readMark = db.wa_read_marks[m.to_phone]
  if (readMark && readMark >= m.created_at) return 'read'
  return ORDER[m.status] >= ORDER.delivered ? m.status : 'delivered'
}

/** Moves message statuses forward (the webhook `statuses[]` part). Safe to run in every tab. */
export function tickWhatsApp(now: number = Date.now()): number {
  const snapshot = readDb()
  const due = snapshot.whatsapp_messages.some((m) => targetStatus(snapshot, m, now) !== m.status)
  if (!due) return 0
  return mutate((db, touch) => {
    let changed = 0
    for (const m of db.whatsapp_messages) {
      const next = targetStatus(db, m, now)
      if (next === m.status) continue
      const wasSent = ORDER[m.status] >= ORDER.sent && m.status !== 'failed'
      m.status = next
      m.updated_at = new Date(now).toISOString()
      if (next === 'failed') {
        m.error_code = '131026'
        m.error_title = 'Message undeliverable'
      }
      if (!wasSent && next !== 'failed' && m.visit_id && m.template !== 'sos_admin_alert') {
        const v = db.visits.find((x) => x.id === m.visit_id)
        if (v) logVisitEvent(db, v, 'link_sent', { message_id: m.id, template: m.template }, null, m.updated_at)
      }
      changed += 1
    }
    if (changed) touch('whatsapp_messages', 'visits')
    return changed
  })
}

/* ------------------------------------------------------------- simulator inbox */

function toSimMessages(db: DemoDb, phone: string): SimMessage[] {
  const out: SimMessage[] = db.whatsapp_messages
    .filter((m) => m.to_phone === phone)
    .map((m) => ({
      id: m.id,
      direction: 'out' as const,
      body: m.body,
      language: m.language,
      status: m.status,
      error_code: m.error_code,
      error_title: m.error_title,
      button_label: m.button_label,
      button_url: m.button_url,
      created_at: m.created_at,
    }))
  db.wa_texts
    .filter((t) => t.phone === phone)
    .forEach((t) =>
      out.push({
        id: t.id,
        direction: t.direction,
        body: t.body,
        language: t.language,
        status: t.direction === 'in' ? 'read' : 'delivered',
        error_code: null,
        error_title: null,
        button_label: null,
        button_url: null,
        created_at: t.created_at,
      }),
    )
  return out.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export function listChats(): SimChat[] {
  const db = readDb()
  const phones = new Set<string>([...db.whatsapp_messages.map((m) => m.to_phone), ...db.wa_texts.map((t) => t.phone)])
  const chats: SimChat[] = []
  phones.forEach((phone) => {
    const msgs = toSimMessages(db, phone)
    const last = msgs[msgs.length - 1]
    if (!last) return
    const driver = db.drivers
      .filter((d) => d.phone_e164 === phone)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const staff = db.profiles.find((p) => p.phone === phone)
    chats.push({
      phone,
      name: driver?.name ?? staff?.full_name ?? null,
      last_body: last.body,
      last_at: last.created_at,
      last_status: last.status,
      unread: msgs.filter((m) => m.direction === 'out' && (m.status === 'sent' || m.status === 'delivered')).length,
    })
  })
  return chats.sort((a, b) => b.last_at.localeCompare(a.last_at))
}

export function getChat(phone: string): SimMessage[] {
  return toSimMessages(readDb(), phone)
}

export function markChatRead(phone: string): void {
  mutate((db, touch) => {
    const now = nowIso()
    db.wa_read_marks[phone] = now
    for (const m of db.whatsapp_messages) {
      if (m.to_phone === phone && (m.status === 'sent' || m.status === 'delivered')) {
        m.status = 'read'
        m.updated_at = now
      }
    }
    touch('whatsapp_messages')
  })
}

export function markMessageRead(messageId: string): void {
  mutate((db, touch) => {
    const m = db.whatsapp_messages.find((x) => x.id === messageId)
    if (!m || m.status === 'failed' || m.status === 'read') return
    m.status = 'read'
    m.updated_at = nowIso()
    touch('whatsapp_messages')
  })
}

/** Inbound text from a driver (webhook `messages[]`): reply with a fresh link and the slot, or a not-found text. */
export async function receiveInbound(phoneInput: string, text: string): Promise<void> {
  const phone = normalizeIndianPhone(phoneInput) ?? phoneInput
  const token = await createToken()
  mutate((db, touch) => {
    const now = Date.now()
    db.wa_texts.push({
      id: newId(),
      phone,
      direction: 'in',
      body: text.trim() || '(photo)',
      language: 'en',
      created_at: new Date(now).toISOString(),
    })
    const ev = db.events.find((e) => e.status === 'live')
    const drivers = ev ? db.drivers.filter((d) => d.event_id === ev.id && d.phone_e164 === phone) : []
    let found: { visit: VisitRow; lang: Language; driverId: string } | null = null
    for (const d of drivers) {
      const v = db.visits
        .filter(
          (x) =>
            x.driver_id === d.id &&
            (isActive(x.status) || (x.status === 'exited' && x.exited_at && now - new Date(x.exited_at).getTime() < 12 * 3600_000)),
        )
        .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))[0]
      if (v) found = { visit: v, lang: d.preferred_language, driverId: d.id }
    }
    let body: string
    let lang: Language = 'en'
    if (found && ev) {
      const slot = db.slots.find((s) => s.id === found.visit.slot_id)
      const zone = db.zones.find((z) => z.id === found.visit.zone_id)
      db.driver_access_tokens.push({
        id: newId(),
        driver_id: found.driverId,
        token_hash: token.hash,
        expires_at: new Date(new Date(ev.ends_at).getTime() + 6 * 3600_000).toISOString(),
        revoked_at: null,
        last_used_at: null,
        use_count: 0,
        created_at: nowIso(),
      })
      lang = found.lang
      const label = slot?.label ?? ''
      const zoneName = zone ? (lang === 'ml' && zone.name_ml ? zone.name_ml : zone.name) : ''
      body =
        lang === 'ml'
          ? `നിങ്ങളുടെ സ്ലോട്ട് ${zoneName} ഭാഗത്തെ ${label} ആണ്. പാർക്കിംഗ് മാപ്പ്: ${driverLink(token.raw)}`
          : `Your slot is ${label} in ${zoneName}. Open your parking map: ${driverLink(token.raw)}`
    } else {
      body = "We couldn't find parking for this number today. Please ask a volunteer at the gate."
    }
    db.wa_texts.push({
      id: newId(),
      phone,
      direction: 'out',
      body,
      language: lang,
      created_at: new Date(now + 1).toISOString(),
    })
    touch('whatsapp_messages')
  })
}

export { formatPlate }
