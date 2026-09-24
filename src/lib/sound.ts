/**
 * Sound and haptics for SOS emergency alerts across staff screens.
 * Uses Web Audio API with auto-unlocking on first user gesture.
 */

let sharedAudioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx()
    } catch {
      return null
    }
  }
  return sharedAudioContext
}

// Auto-unlock AudioContext on first user interaction so SOS alarms can play reliably
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume()
    }
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock, { passive: true })
}

/** Plays 3 short alarm beeps for SOS emergencies. */
export function playSosAlarm(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  const start = ctx.currentTime + 0.05
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    const t0 = start + i * 0.3
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.2)
  }
}

/** Triggers mobile device vibration pattern for emergency. */
export function vibrateEmergency(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([250, 100, 250, 100, 400])
    } catch {
      /* vibration ignored */
    }
  }
}
