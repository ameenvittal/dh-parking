import { beforeEach, describe, expect, it } from 'vitest'
import { answer } from '@/lib/demo/assistant'
import { setupDemo, signIn } from './demo-setup'

describe('demo assistant answer', () => {
  beforeEach(() => {
    setupDemo()
    signIn('admin')
  })

  it('answers "Which zone is almost full?" cleanly when all zones are empty', () => {
    const res = answer({ sessionId: 's1', message: 'Which zone is almost full?', language: 'en' })
    expect(res.reply).toContain('No zones are almost full right now')
    expect(res.reply).toContain('0% occupancy')
    expect(res.reply).toContain('| Zone | Free | Assigned | Parked | Blocked | Occupancy |')
    expect(res.reply).toContain('|:---|---:|---:|---:|---:|---:|')
    expect(res.tools_used.map((t) => t.name)).toContain('get_zone_status')
  })

  it('answers alerts query cleanly', () => {
    const res = answer({ sessionId: 's1', message: 'Any open SOS?', language: 'en' })
    expect(res.reply).toContain('No open SOS right now.')
    expect(res.tools_used.map((t) => t.name)).toContain('list_open_alerts')
  })

  it('handles unknown vehicle query cleanly', () => {
    const res = answer({ sessionId: 's1', message: 'Where is KL02AB9999?', language: 'en' })
    expect(res.reply).toContain('No vehicle matches **KL02AB9999**.')
    expect(res.tools_used.map((t) => t.name)).toContain('find_vehicle')
  })
})
