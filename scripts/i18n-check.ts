/**
 * docs/10-I18N.md section 5: every key in `en` exists in `ml` and the other way round,
 * no empty values, and interpolation variables match between languages.
 * Admin screens are English only (user decision), so `admin` and `reports` are checked
 * for empty values only.
 * Also flags top-level keys named like a namespace: with `.` as the namespace
 * separator, `t('map.x')` inside another namespace would be read as the map namespace.
 *
 * Run: pnpm i18n:check
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', 'src', 'locales')
const LANGS = ['en', 'ml'] as const
const NAMESPACES = ['common', 'driver', 'gate', 'zone', 'admin', 'map', 'reports', 'errors']
const ENGLISH_ONLY = new Set(['admin', 'reports'])

type Json = { [key: string]: Json } | string | number | boolean | null | Json[]

function flatten(value: Json, prefix: string, out: Map<string, string>) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
    return
  }
  out.set(prefix, typeof value === 'string' ? value : JSON.stringify(value))
}

function load(lang: string, ns: string): Map<string, string> | null {
  const file = join(ROOT, lang, `${ns}.json`)
  if (!existsSync(file)) return null
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const out = new Map<string, string>()
  flatten(parsed as Json, '', out)
  return out
}

function vars(s: string): string[] {
  return [...s.matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => m[1]).sort()
}

/** `key_one` and `key_other` share one base key. */
function base(key: string): string {
  return key.replace(/_(zero|one|two|few|many|other)$/, '')
}

const problems: string[] = []

for (const lang of LANGS) {
  const dir = join(ROOT, lang)
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir)) {
    const ns = f.replace(/\.json$/, '')
    if (!NAMESPACES.includes(ns)) problems.push(`${lang}/${f}: unknown namespace file`)
  }
}

for (const ns of NAMESPACES) {
  const en = load('en', ns)
  const ml = load('ml', ns)
  if (!en) {
    problems.push(`en/${ns}.json is missing`)
    continue
  }

  for (const [lang, map] of [['en', en], ['ml', ml]] as const) {
    if (!map) continue
    const clashes = new Set<string>()
    for (const [k, v] of map) {
      if (v.trim() === '') problems.push(`${lang}/${ns}.json: "${k}" is empty`)
      const top = k.split('.')[0]
      if (NAMESPACES.includes(top)) clashes.add(top)
    }
    for (const top of clashes) problems.push(`${lang}/${ns}.json: top-level key "${top}" clashes with a namespace name`)
  }

  if (ENGLISH_ONLY.has(ns)) continue
  if (!ml) {
    problems.push(`ml/${ns}.json is missing`)
    continue
  }

  const mlBases = new Set([...ml.keys()].map(base))
  const enBases = new Set([...en.keys()].map(base))
  for (const k of en.keys()) {
    if (!ml.has(k) && !mlBases.has(base(k))) problems.push(`ml/${ns}.json: missing "${k}"`)
  }
  for (const k of ml.keys()) {
    if (!en.has(k) && !enBases.has(base(k))) problems.push(`en/${ns}.json: missing "${k}" (only in ml)`)
  }
  for (const [k, v] of en) {
    const other = ml.get(k)
    if (other === undefined) continue
    const a = vars(v).join(',')
    const b = vars(other).join(',')
    if (a !== b) problems.push(`${ns}.${k}: variables differ, en {${a}} ml {${b}}`)
  }
}

if (problems.length) {
  console.error(`i18n check failed with ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}
console.log('i18n check passed')
