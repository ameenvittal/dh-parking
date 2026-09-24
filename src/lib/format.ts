import { formatInTimeZone } from 'date-fns-tz'
import { APP_TIMEZONE } from '@/config/app'
import type { Language } from '@/types/domain'

/** `KL02AB1234` becomes `KL 02 AB 1234`, `22BH1234AA` becomes `22 BH 1234 AA`. */
export function formatPlate(plate: string): string {
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const bh = /^([0-9]{2})(BH)([0-9]{4})([A-Z]{1,2})$/.exec(p)
  if (bh) return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`
  const std = /^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/.exec(p)
  if (std) return [std[1], std[2], std[3], std[4]].filter(Boolean).join(' ')
  return p
}

/** Under 100 m to the nearest 10 m, else the nearest 50 m. 1000 m and over shows km. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, meters)
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  if (m < 100) return `${Math.max(0, Math.round(m / 10) * 10)} m`
  return `${Math.round(m / 50) * 50} m`
}

/** Exact metres for lists ("120 m from this gate"). */
export function formatMetres(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

export function formatClock(iso: string | Date): string {
  return formatInTimeZone(iso, APP_TIMEZONE, 'h:mm a', {}).toLowerCase()
}

export function formatClockSeconds(iso: string | Date): string {
  return formatInTimeZone(iso, APP_TIMEZONE, 'h:mm:ss a', {}).toLowerCase()
}

export function formatDateTime(iso: string | Date): string {
  return formatInTimeZone(iso, APP_TIMEZONE, 'd MMM, h:mm a', {}).replace(/AM|PM/, (m) => m.toLowerCase())
}

export function formatDate(iso: string | Date): string {
  return formatInTimeZone(iso, APP_TIMEZONE, 'd MMM yyyy', {})
}

export function isoDay(iso: string | Date): string {
  return formatInTimeZone(iso, APP_TIMEZONE, 'yyyy-MM-dd', {})
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  return r === 0 ? `${h} h` : `${h} h ${r} min`
}

type Translate = (key: string, options?: Record<string, unknown>) => string

/** Relative under one hour ("6 min ago"), else the clock time in IST. */
export function formatRelative(iso: string, t: Translate, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60_000)
  if (diffMs < 45_000) return t('common.justNow')
  if (min < 60) return t('common.minAgo', { count: Math.max(1, min) })
  return formatClock(iso)
}

export function localName(obj: { name: string; name_ml?: string | null }, lang: Language | string): string {
  return lang === 'ml' && obj.name_ml ? obj.name_ml : obj.name
}

export function uid(): string {
  return crypto.randomUUID()
}
