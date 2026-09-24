import { AppError } from '@/lib/errors'
import { formatClock, formatPlate } from '@/lib/format'
import { ALERT_TYPES } from '@/types/domain'
import type { AlertType, AssistantMessageRow, Language, VehicleType } from '@/types/domain'
import { liveEvent, requireRole } from './core'
import { mutate, nextSeq, nowIso, readDb } from './db'
import { reportPeakHours, reportVehicleCounts } from './reports'
import { getDashboardSummary, getVisitDetail, listAlerts, searchVisits } from './rpc'
import type { AssistantInput, AssistantReply, AssistantToolUse } from './types'

/**
 * Demo admin assistant (docs/08 section 4). Deterministic: keyword intents are mapped
 * to the same read-only tools the Gemini version would call, and the answer is built
 * from their results as markdown. Nothing is changed.
 */

type Tr = { en: string; ml: string }
const tr = (lang: Language, s: Tr) => (lang === 'ml' ? s.ml : s.en)

function timed<T>(used: AssistantToolUse[], name: string, args: Record<string, unknown>, fn: () => T): T {
  const started = performance.now()
  const out = fn()
  used.push({ name, args, ms: Math.max(1, Math.round(performance.now() - started)) })
  return out
}

const PLATE_RE = /\b([A-Za-z]{2}\s?-?\d{1,2}\s?-?[A-Za-z]{0,3}\s?-?\d{1,4}|\d{2}\s?BH\s?\d{4}\s?[A-Za-z]{1,2})\b/
const TYPE_WORDS: Record<VehicleType, RegExp> = {
  bike: /\b(bikes?|two.?wheelers?|scooters?)\b|ബൈക്ക്/i,
  car: /\bcars?\b|കാർ/i,
  ev: /\bevs?\b|electric/i,
  bus: /\bbus(es)?\b|ബസ്/i,
  other: /\bautos?\b|trucks?/i,
}

export function answer(input: AssistantInput): AssistantReply {
  const db = readDb()
  requireRole(db, ['admin'])
  const ev = liveEvent(db)
  const lang = input.language
  const used: AssistantToolUse[] = []
  if (!ev) return { reply: tr(lang, { en: 'No event is live right now.', ml: 'ഇപ്പോൾ ഒരു പരിപാടിയും നടക്കുന്നില്ല.' }), tools_used: [] }
  const q = input.message.trim()
  const lower = q.toLowerCase()

  /* find a vehicle */
  const plateMatch = PLATE_RE.exec(q)
  const last4 = /\b(\d{4})\b/.exec(q)
  if (plateMatch || (last4 && /where|find|locate|evide|എവിടെ/i.test(lower))) {
    const query = plateMatch ? plateMatch[1] : last4![1]
    const found = timed(used, 'find_vehicle', { query }, () => searchVisits({ eventId: ev.id, query, limit: 5 }))
    if (found.length === 0)
      return { reply: tr(lang, { en: `No vehicle matches **${query}**.`, ml: `**${query}** എന്ന വാഹനം കണ്ടെത്തിയില്ല.` }), tools_used: used }
    if (found.length === 1) {
      const v = found[0]
      const d = timed(used, 'get_vehicle_detail', { visit_id: v.id }, () => getVisitDetail(v.id))
      const lines = [
        tr(lang, {
          en: `**${formatPlate(v.plate)}** is ${v.status.replace('_', ' ')} at **${v.slot_label ?? 'no slot'}**${v.zone_name ? ` (${v.zone_name})` : ''}.`,
          ml: `**${formatPlate(v.plate)}**: സ്ലോട്ട് **${v.slot_label ?? '-'}**${v.zone_name ? ` (${v.zone_name})` : ''}, നില ${v.status}.`,
        }),
        '',
        '| Field | Details |',
        '|:---|:---|',
        `| ${tr(lang, { en: 'Checked in', ml: 'ചെക്ക് ഇൻ' })} | ${formatClock(v.checked_in_at)}${v.entry_gate_name ? `, ${v.entry_gate_name}` : ''} |`,
        `| ${tr(lang, { en: 'Type', ml: 'തരം' })} | ${v.vehicle_type}, ${v.category} |`,
        `| ${tr(lang, { en: 'Phone', ml: 'ഫോൺ' })} | ${v.phone ?? v.phone_masked} |`,
        `| ${tr(lang, { en: 'Open alerts', ml: 'തുറന്ന അലേർട്ടുകൾ' })} | ${d.alerts.filter((a) => a.status !== 'resolved').length} |`,
      ]
      return { reply: lines.join('\n'), tools_used: used }
    }
    const rows = found.map((v) => `| ${formatPlate(v.plate)} | ${v.slot_label ?? '-'} | ${v.status.replace('_', ' ')} | ${formatClock(v.checked_in_at)} |`)
    return {
      reply: [
        tr(lang, { en: `${found.length} vehicles match **${query}**:`, ml: `**${query}** എന്നതിന് ${found.length} വാഹനങ്ങൾ:` }),
        '',
        '| Plate | Slot | Status | Checked in |',
        '|:---|:---|:---|---:|',
        ...rows,
      ].join('\n'),
      tools_used: used,
    }
  }

  /* alerts */
  if (/\bsos\b|alert|emergency|അലേർട്ട്/i.test(lower)) {
    const type: AlertType | undefined = /\bsos\b/i.test(lower)
      ? 'sos'
      : ALERT_TYPES.find((t) => lower.includes(t.replace('_', ' ')))
    const open = timed(used, 'list_open_alerts', type ? { type } : {}, () =>
      listAlerts({ eventId: ev.id, types: type ? [type] : undefined }).filter((a) => a.status !== 'resolved').slice(0, 20),
    )
    if (open.length === 0)
      return {
        reply: tr(lang, {
          en: type === 'sos' ? 'No open SOS right now.' : 'No open alerts right now.',
          ml: type === 'sos' ? 'ഇപ്പോൾ തുറന്ന SOS ഇല്ല.' : 'ഇപ്പോൾ തുറന്ന അലേർട്ടുകൾ ഇല്ല.',
        }),
        tools_used: used,
      }
    return {
      reply: [
        tr(lang, { en: `${open.length} open alerts. Handle them on the Alerts page.`, ml: `${open.length} തുറന്ന അലേർട്ടുകൾ. Alerts പേജിൽ കൈകാര്യം ചെയ്യുക.` }),
        '',
        '| Type | Vehicle | Zone | Raised at |',
        '|:---|:---|:---|---:|',
        ...open.map((a) => `| ${a.type.replace('_', ' ')} | ${a.plate ? formatPlate(a.plate) : '-'} | ${a.zone_code ?? '-'} | ${formatClock(a.created_at)} |`),
      ].join('\n'),
      tools_used: used,
    }
  }

  /* revenue */
  if (/revenue|collect|money|fee|cash|upi|വരുമാനം|ഫീസ്/i.test(lower)) {
    return {
      reply: tr(lang, {
        en: 'Parking is completely free for this event. No fee is collected.',
        ml: 'ഈ പരിപാടിക്ക് പാർക്കിംഗ് പൂർണ്ണമായും സൗജന്യമാണ്. ഫീസ് ഈടാക്കുന്നില്ല.',
      }),
      tools_used: used,
    }
  }

  /* arrivals in a time window */
  const hours = /last\s+(\d+)?\s*hours?|past\s+(\d+)?\s*hours?|last hour|മണിക്കൂർ/i.exec(lower)
  if (hours || /arriv|came in|exits?\b|left|peak|busiest/i.test(lower)) {
    const h = hours ? Number(hours[1] ?? hours[2] ?? 1) || 1 : null
    const from = h ? new Date(Date.now() - h * 3600_000).toISOString() : undefined
    const type = (Object.keys(TYPE_WORDS) as VehicleType[]).find((t) => TYPE_WORDS[t].test(q))
    if (type && from) {
      const counts = timed(used, 'get_vehicle_counts', { from }, () => reportVehicleCounts({ eventId: ev.id, from }))
      const n = counts.by_type.find((x) => x.type === type)?.count ?? 0
      return {
        reply: tr(lang, {
          en: `**${n}** ${type} vehicles checked in during the last ${h === 1 ? 'hour' : `${h} hours`}.`,
          ml: `കഴിഞ്ഞ ${h} മണിക്കൂറിൽ **${n}** ${type} വാഹനങ്ങൾ എത്തി.`,
        }),
        tools_used: used,
      }
    }
    const args = { from: from ?? null, interval_min: h && h <= 2 ? 15 : 60 }
    const p = timed(used, 'get_arrivals_exits', args, () =>
      reportPeakHours({ eventId: ev.id, from, intervalMin: args.interval_min as 15 | 60 }),
    )
    const totalA = p.series.reduce((s, x) => s + x.arrivals, 0)
    const totalE = p.series.reduce((s, x) => s + x.exits, 0)
    const busy = p.busiest_arrival
    return {
      reply: [
        tr(lang, {
          en: `${totalA} arrivals and ${totalE} exits${h ? ` in the last ${h === 1 ? 'hour' : `${h} hours`}` : ' so far'}.${busy ? ` Busiest arrival window starts at ${formatClock(busy.t)} with ${busy.count}.` : ''}`,
          ml: `${totalA} വാഹനങ്ങൾ എത്തി, ${totalE} പോയി.${busy ? ` ഏറ്റവും തിരക്ക് ${formatClock(busy.t)} മുതൽ (${busy.count}).` : ''}`,
        }),
        '',
        '| Window | Arrivals | Exits |',
        '|:---|---:|---:|',
        ...p.series.filter((s) => s.arrivals + s.exits > 0).slice(-8).map((s) => `| ${formatClock(s.t)} | ${s.arrivals} | ${s.exits} |`),
      ].join('\n'),
      tools_used: used,
    }
  }

  /* counts by category or type */
  if (/how many|count|category|categories|type|എത്ര/i.test(lower) && !/zone|free|full/i.test(lower)) {
    const c = timed(used, 'get_vehicle_counts', {}, () => reportVehicleCounts({ eventId: ev.id }))
    return {
      reply: [
        tr(lang, { en: `**${c.total}** vehicles checked in so far.`, ml: `ഇതുവരെ **${c.total}** വാഹനങ്ങൾ എത്തി.` }),
        '',
        '| Vehicle type | Count |',
        '|:---|---:|',
        ...c.by_type.map((x) => `| ${x.type} | ${x.count} |`),
        '',
        '| Category | Count |',
        '|:---|---:|',
        ...c.by_category.map((x) => `| ${x.category} | ${x.count} |`),
      ].join('\n'),
      tools_used: used,
    }
  }

  /* zone status */
  const codes = new Set(db.zones.filter((z) => z.event_id === ev.id).map((z) => z.code))
  const zoneCode = [...q.matchAll(/zone\s+([a-z0-9]{1,4})\b/gi)]
    .map((m) => m[1].toUpperCase())
    .find((c) => codes.has(c))
  if (zoneCode || /zone|full|free|space|occupan|സോൺ|ഒഴിവ്/i.test(lower)) {
    const s = timed(used, 'get_zone_status', zoneCode ? { zone_code: zoneCode } : {}, () => getDashboardSummary(ev.id))
    const zones = s.zones.filter((z) => !zoneCode || z.code === zoneCode)
    if (zones.length === 0)
      return { reply: tr(lang, { en: `There is no zone ${zoneCode}.`, ml: `${zoneCode} എന്ന സോൺ ഇല്ല.` }), tools_used: used }
    const fullest = [...zones].sort((a, b) => b.occupancy_pct - a.occupancy_pct)[0]

    let summary: string
    if (zoneCode) {
      if (fullest.occupancy_pct >= 75) {
        summary = tr(lang, {
          en: `Zone ${fullest.code} (${fullest.name}) is almost full at **${fullest.occupancy_pct}%** with only ${fullest.available} free slots remaining.`,
          ml: `സോൺ ${fullest.code} (${fullest.name}) **${fullest.occupancy_pct}%** നിറഞ്ഞു, ${fullest.available} ഒഴിവ് ബാക്കി.`,
        })
      } else if (fullest.occupancy_pct === 0) {
        summary = tr(lang, {
          en: `Zone ${fullest.code} (${fullest.name}) is completely open at 0% occupancy with all ${fullest.available} slots free.`,
          ml: `സോൺ ${fullest.code} (${fullest.name}) പൂർണ്ണമായും ഒഴിവാണ് (0% ഒക്യുപ്പൻസി, ${fullest.available} ഒഴിവ്).`,
        })
      } else {
        summary = tr(lang, {
          en: `Zone ${fullest.code} (${fullest.name}) is at **${fullest.occupancy_pct}%** occupancy with ${fullest.available} free slots.`,
          ml: `സോൺ ${fullest.code} (${fullest.name}) **${fullest.occupancy_pct}%** ഒക്യുപ്പൻസിയിലാണ് (${fullest.available} ഒഴിവ്).`,
        })
      }
    } else {
      const isAskingAlmostFull = /almost|nearly|full/i.test(lower)
      if (fullest.occupancy_pct === 0) {
        summary = tr(lang, {
          en: isAskingAlmostFull
            ? `No zones are almost full right now. All zones are open with 0% occupancy (**${s.slots.available}** free slots total).`
            : `All zones are open with 0% occupancy (**${s.slots.available}** free slots total).`,
          ml: isAskingAlmostFull
            ? `ഇപ്പോൾ ഒരു സോണും നിറഞ്ഞിട്ടില്ല. എല്ലാ സോണുകളിലും ധാരാളം ഒഴിവുണ്ട് (0% ഒക്യുപ്പൻസി, ആകെ **${s.slots.available}** ഒഴിവ്).`
            : `എല്ലാ സോണുകളിലും പൂർണ്ണമായും ഒഴിവുണ്ട് (ആകെ **${s.slots.available}** ഒഴിവ്).`,
        })
      } else if (fullest.occupancy_pct < 75) {
        summary = tr(lang, {
          en: isAskingAlmostFull
            ? `No zones are almost full right now. Highest occupancy is Zone ${fullest.code} (${fullest.name}) at **${fullest.occupancy_pct}%** with ${fullest.available} free slots.`
            : `Zone ${fullest.code} (${fullest.name}) has the highest occupancy at **${fullest.occupancy_pct}%** with ${fullest.available} free slots.`,
          ml: `ഇപ്പോൾ ഒരു സോണും നിറഞ്ഞിട്ടില്ല. കൂടുതൽ ഒക്യുപ്പൻസി സോൺ ${fullest.code} (${fullest.name}) ആണ് (**${fullest.occupancy_pct}%**, ${fullest.available} ഒഴിവ്).`,
        })
      } else {
        summary = tr(lang, {
          en: `Zone ${fullest.code} (${fullest.name}) is almost full at **${fullest.occupancy_pct}%** with only ${fullest.available} free slots remaining.`,
          ml: `സോൺ ${fullest.code} (${fullest.name}) **${fullest.occupancy_pct}%** നിറഞ്ഞു, ${fullest.available} ഒഴിവ് ബാക്കി.`,
        })
      }
    }

    return {
      reply: [
        summary,
        '',
        '| Zone | Free | Assigned | Parked | Blocked | Occupancy |',
        '|:---|---:|---:|---:|---:|---:|',
        ...zones.map((z) => `| Zone ${z.code} (${z.name}) | ${z.available} | ${z.assigned} | ${z.occupied} | ${z.blocked} | ${z.occupancy_pct}% |`),
      ].join('\n'),
      tools_used: used,
    }
  }

  /* changes are not possible */
  if (/reassign|block|move|cancel|send|message|change|delete/i.test(lower)) {
    return {
      reply: tr(lang, {
        en: 'I can only read data. To reassign or cancel, use the Vehicles page. To block slots, use Zones and slots. To handle alerts, use the Alerts page.',
        ml: 'എനിക്ക് വിവരങ്ങൾ വായിക്കാൻ മാത്രമേ കഴിയൂ. മാറ്റങ്ങൾക്ക് Vehicles, Zones and slots, Alerts പേജുകൾ ഉപയോഗിക്കുക.',
      }),
      tools_used: [],
    }
  }

  /* default: live summary */
  const s = timed(used, 'get_live_summary', {}, () => getDashboardSummary(ev.id))
  return {
    reply: [
      tr(lang, {
        en: `${ev.name} right now: **${s.slots.available}** free slots, ${s.visits.en_route} on the way, ${s.visits.awaiting_confirm} waiting for a volunteer, ${s.visits.confirmed} parked, ${s.visits.exited} left. ${s.alerts.open} open alerts${s.alerts.sos_open > 0 ? `, including ${s.alerts.sos_open} SOS` : ''}.`,
        ml: `${ev.name}: **${s.slots.available}** ഒഴിവുള്ള സ്ലോട്ടുകൾ, ${s.visits.en_route} വഴിയിൽ, ${s.visits.confirmed} പാർക്ക് ചെയ്തു, ${s.visits.exited} പോയി. ${s.alerts.open} തുറന്ന അലേർട്ടുകൾ.`,
      }),
    ].join('\n'),
    tools_used: used,
  }
}

export async function askAssistant(input: AssistantInput): Promise<AssistantReply> {
  const db = readDb()
  const caller = requireRole(db, ['admin'])
  if (!input.message.trim()) throw new AppError('BAD_REQUEST')
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 500))
  const reply = answer(input)
  mutate((m) => {
    const base = { admin_id: caller.actor.id ?? '', session_id: input.sessionId }
    m.assistant_messages.push({ id: nextSeq(m), ...base, role: 'user', content: input.message, tool_calls: null, created_at: nowIso() })
    m.assistant_messages.push({
      id: nextSeq(m),
      ...base,
      role: 'assistant',
      content: reply.reply,
      tool_calls: reply.tools_used,
      created_at: nowIso(),
    })
  })
  return reply
}

export function getAssistantHistory(sessionId: string): AssistantMessageRow[] {
  const db = readDb()
  const caller = requireRole(db, ['admin'])
  return db.assistant_messages
    .filter((m) => m.session_id === sessionId && m.admin_id === caller.actor.id && m.role !== 'tool')
    .sort((a, b) => a.id - b.id)
    .slice(-40)
}
