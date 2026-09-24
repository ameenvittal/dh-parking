import * as THREE from 'three'
import { formatPlate } from '@/lib/format'

export function createPlateTexture(plate?: string | null, isEV = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  if (ctx) {
    // Fill background: EV is green (#1E8E52), standard is white (#FFFFFF)
    ctx.fillStyle = isEV ? '#1E8E52' : '#FFFFFF'
    ctx.fillRect(0, 0, 256, 64)

    // Border
    ctx.strokeStyle = isEV ? '#0E4E2C' : '#162033'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, 250, 58)

    // Left blue IND strip
    ctx.fillStyle = '#1F4FD6'
    ctx.fillRect(6, 6, 24, 52)

    // IND text
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('IND', 18, 32)

    // Plate Text
    const text = plate ? formatPlate(plate) : 'KL 01 AB 1234'
    ctx.fillStyle = isEV ? '#FFFFFF' : '#162033'
    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 145, 32)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}
