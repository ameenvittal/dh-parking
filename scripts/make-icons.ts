/**
 * Draws the PWA icons (docs/02 section 10): a blue rounded square with a white P.
 * No dependencies: pixels are rasterised here and written as PNG with node:zlib.
 * Colours are the primary and on-primary tokens from src/styles/theme.css.
 *
 * Run: node scripts/make-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'

const PRIMARY = [0x1f, 0x4f, 0xd6] as const
const WHITE = [0xff, 0xff, 0xff] as const
const OUT = join(import.meta.dirname, '..', 'public', 'icons')

type Shape = (x: number, y: number) => boolean

/** Letter P on a 512 unit grid, centred. `scale` shrinks it around the centre (maskable safe zone). */
function letterP(scale: number): Shape {
  const t = (v: number) => 256 + (v - 256) * scale
  const stemL = t(172), stemR = t(236), top = t(116), bottom = t(396)
  const bowlCx = t(282), bowlCy = t(210), outerR = 94 * scale, innerR = 34 * scale
  const bowlTop = bowlCy - outerR, bowlBottom = bowlCy + outerR
  const innerTop = bowlCy - innerR, innerBottom = bowlCy + innerR
  return (x, y) => {
    if (x >= stemL && x <= stemR && y >= top && y <= bottom) return true
    const inOuter = (x >= stemR - 1 && x <= bowlCx && y >= bowlTop && y <= bowlBottom) ||
      (x > bowlCx && (x - bowlCx) ** 2 + (y - bowlCy) ** 2 <= outerR ** 2)
    if (!inOuter) return false
    const inInner = (x >= stemR && x <= bowlCx && y > innerTop && y < innerBottom) ||
      (x > bowlCx && (x - bowlCx) ** 2 + (y - bowlCy) ** 2 < innerR ** 2)
    return !inInner
  }
}

function roundedSquare(radius: number): Shape {
  return (x, y) => {
    const cx = Math.min(Math.max(x, radius), 512 - radius)
    const cy = Math.min(Math.max(y, radius), 512 - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
  }
}

function render(size: number, background: Shape, letter: Shape): Buffer {
  const SS = 4
  const rows: Buffer[] = []
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let px = 0; px < size; px++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 512
          const y = ((py + (sy + 0.5) / SS) / size) * 512
          if (background(x, y)) {
            bg++
            if (letter(x, y)) fg++
          }
        }
      }
      const n = SS * SS
      const a = bg / n
      const f = bg ? fg / bg : 0
      const o = 1 + px * 4
      for (let c = 0; c < 3; c++) row[o + c] = Math.round(PRIMARY[c] * (1 - f) + WHITE[c] * f)
      row[o + 3] = Math.round(a * 255)
    }
    rows.push(row)
  }
  return png(size, Buffer.concat(rows))
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size: number, raw: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
const rounded = roundedSquare(112)
const full: Shape = () => true
writeFileSync(join(OUT, 'icon-192.png'), render(192, rounded, letterP(1)))
writeFileSync(join(OUT, 'icon-512.png'), render(512, rounded, letterP(1)))
writeFileSync(join(OUT, 'icon-maskable-512.png'), render(512, full, letterP(0.72)))
writeFileSync(join(OUT, 'apple-touch-icon.png'), render(180, full, letterP(0.86)))
console.log('Icons written to public/icons')
