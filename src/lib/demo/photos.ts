import { isoDay } from '@/lib/format'
import { newId } from './core'
import { sharedStorage } from './storage'
import type { PhotoUpload } from './types'

/**
 * Simulated Storage buckets. The full photo (max 1280 px JPEG) stays in memory in the
 * uploading tab for the AI read; a small copy (480 px) goes to localStorage so other tabs
 * (zone, admin) can show it. Only the newest photos are kept to stay within quota.
 */

const KEY = 'eventpark.demo.photos.v1'
const MAX_KEPT = 24
const full = new Map<string, string>()

type Kept = { path: string; dataUrl: string }[]

function readKept(): Kept {
  try {
    const raw = sharedStorage().getItem(KEY)
    return raw ? (JSON.parse(raw) as Kept) : []
  } catch {
    return []
  }
}

function writeKept(list: Kept): void {
  let trimmed = list.slice(-MAX_KEPT)
  while (trimmed.length > 0) {
    try {
      sharedStorage().setItem(KEY, JSON.stringify(trimmed))
      return
    } catch {
      trimmed = trimmed.slice(1)
    }
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(bin)}`
}

async function resize(blob: Blob, maxPx: number, quality: number): Promise<string> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return blobToDataUrl(blob)
  try {
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return blobToDataUrl(blob)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return blobToDataUrl(blob)
  }
}

export async function savePhoto(
  bucket: 'vehicle-photos' | 'alert-photos',
  eventId: string,
  blob: Blob,
): Promise<PhotoUpload> {
  const path =
    bucket === 'vehicle-photos'
      ? `${bucket}/${eventId}/${isoDay(new Date())}/${newId()}.jpg`
      : `${bucket}/${eventId}/${newId()}.jpg`
  const large = await resize(blob, 1280, 0.8)
  full.set(path, large)
  const small = await resize(blob, 480, 0.7)
  writeKept([...readKept().filter((k) => k.path !== path), { path, dataUrl: small }])
  return { path, url: large }
}

export function getPhotoUrl(path: string): string | null {
  return full.get(path) ?? readKept().find((k) => k.path === path)?.dataUrl ?? null
}

/** Base64 JPEG (no data URL prefix) for the AI read, best quality available in this tab. */
export function getPhotoBase64(path: string): string | null {
  const url = getPhotoUrl(path)
  if (!url) return null
  const i = url.indexOf(',')
  return i >= 0 ? url.slice(i + 1) : null
}

export function clearPhotos(): void {
  full.clear()
  sharedStorage().removeItem(KEY)
}
