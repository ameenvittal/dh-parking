import { useCallback, useEffect, useRef, useState } from 'react'

/** "Sound for SOS" toggle. Off by default; turning it on unlocks Web Audio (browsers need a user gesture). */
export function useSosSound() {
  const [enabled, setEnabled] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)

  const toggle = useCallback((on: boolean) => {
    if (on && !ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    if (on) void ctxRef.current?.resume()
    setEnabled(on)
  }, [])

  /** Three short beeps. */
  const play = useCallback(() => {
    const ctx = ctxRef.current
    if (!enabled || !ctx) return
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
  }, [enabled])

  useEffect(() => {
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    }
  }, [])

  return { enabled, toggle, play }
}
