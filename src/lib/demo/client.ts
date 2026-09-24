import { AppError } from '@/lib/errors'
import { ensureBooted } from './boot'

/**
 * Entry point used by every feature api.ts. Boots the demo backend on first use,
 * waits a small artificial network delay, then runs the simulated server call.
 * Unknown errors are wrapped so callers only ever see AppError.
 */

let latency: [number, number] = [80, 200]

/** Tests set this to [0, 0]. */
export function setLatency(min: number, max: number): void {
  latency = [min, max]
}

function wait(): Promise<void> {
  const [min, max] = latency
  if (max <= 0) return Promise.resolve()
  const ms = min + Math.random() * (max - min)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function call<T>(fn: () => T | Promise<T>): Promise<T> {
  ensureBooted()
  await wait()
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AppError) throw err
    console.error('[demo backend]', err)
    throw new AppError('UNKNOWN')
  }
}
