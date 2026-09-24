import { cn } from '@/lib/utils'

/** Dev only: token preview (T-0.2). Token names are technical identifiers, not UI copy. */

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Neutrals', tokens: ['canvas', 'surface', 'surface-2', 'line', 'line-strong', 'ink', 'muted', 'subtle'] },
  { title: 'Action', tokens: ['primary', 'primary-hover', 'primary-soft', 'on-primary', 'focus'] },
  { title: 'Feedback', tokens: ['danger', 'danger-soft', 'warning', 'warning-soft', 'success', 'success-soft'] },
  {
    title: 'Status',
    tokens: [
      'status-available',
      'status-assigned',
      'status-enroute',
      'status-waiting',
      'status-occupied',
      'status-blocked',
      'status-available-soft',
      'status-assigned-soft',
      'status-enroute-soft',
      'status-waiting-soft',
      'status-occupied-soft',
      'status-blocked-soft',
    ],
  },
  { title: 'Zones', tokens: ['zone-1', 'zone-2', 'zone-3', 'zone-4', 'zone-5', 'zone-6', 'zone-7', 'zone-8'] },
  { title: 'Map', tokens: ['map-road', 'map-route', 'traffic-medium', 'traffic-high'] },
]

const BG: Record<string, string> = {
  canvas: 'bg-canvas', surface: 'bg-surface', 'surface-2': 'bg-surface-2', line: 'bg-line', 'line-strong': 'bg-line-strong',
  ink: 'bg-ink', muted: 'bg-muted', subtle: 'bg-subtle', primary: 'bg-primary', 'primary-hover': 'bg-primary-hover',
  'primary-soft': 'bg-primary-soft', 'on-primary': 'bg-on-primary', focus: 'bg-focus', danger: 'bg-danger',
  'danger-soft': 'bg-danger-soft', warning: 'bg-warning', 'warning-soft': 'bg-warning-soft', success: 'bg-success',
  'success-soft': 'bg-success-soft', 'status-available': 'bg-status-available', 'status-assigned': 'bg-status-assigned',
  'status-enroute': 'bg-status-enroute', 'status-waiting': 'bg-status-waiting', 'status-occupied': 'bg-status-occupied',
  'status-blocked': 'bg-status-blocked', 'status-available-soft': 'bg-status-available-soft',
  'status-assigned-soft': 'bg-status-assigned-soft', 'status-enroute-soft': 'bg-status-enroute-soft',
  'status-waiting-soft': 'bg-status-waiting-soft', 'status-occupied-soft': 'bg-status-occupied-soft',
  'status-blocked-soft': 'bg-status-blocked-soft', 'zone-1': 'bg-zone-1', 'zone-2': 'bg-zone-2', 'zone-3': 'bg-zone-3',
  'zone-4': 'bg-zone-4', 'zone-5': 'bg-zone-5', 'zone-6': 'bg-zone-6', 'zone-7': 'bg-zone-7', 'zone-8': 'bg-zone-8',
  'map-road': 'bg-map-road', 'map-route': 'bg-map-route', 'traffic-medium': 'bg-traffic-medium', 'traffic-high': 'bg-traffic-high',
}

const TYPE = [
  ['text-display', 'text-display font-display', 'A-012'],
  ['text-h1', 'text-h1', '210 parked'],
  ['text-h2', 'text-h2', 'Your parking'],
  ['text-h3', 'text-h3', 'Free now'],
  ['text-body', 'text-body', 'Only tap this after your vehicle is in the slot.'],
  ['text-body-sm', 'text-body-sm', 'Assigned 6 min ago'],
  ['text-caption', 'text-caption', 'Waiting for check'],
  ['text-plate', 'text-plate font-display', 'KL 02 AB 1234'],
] as const

export function TokensPage() {
  return (
    <div className="mx-auto flex max-w-360 flex-col gap-10 px-4 py-8 lg:px-8">
      <h1 className="text-h1">/dev/tokens</h1>
      {COLOR_GROUPS.map((g) => (
        <section key={g.title} className="flex flex-col gap-3">
          <h2 className="text-h3">{g.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {g.tokens.map((tok) => (
              <div key={tok} className="overflow-hidden rounded-md border border-line bg-surface">
                <div className={cn('h-14 border-b border-line', BG[tok])} />
                <p className="px-2 py-1.5 font-mono text-caption text-muted">{tok}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Type</h2>
        <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {TYPE.map(([name, cls, sample]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-4 px-4 py-3">
              <span className="w-32 shrink-0 font-mono text-caption text-muted">{name}</span>
              <span className={cls}>{sample}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-baseline gap-4 px-4 py-3" lang="ml">
            <span className="w-32 shrink-0 font-mono text-caption text-muted">ml body</span>
            <span className="text-body">നിങ്ങളുടെ പാർക്കിംഗ് ഉറപ്പായി</span>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3">Radius and shadow</h2>
        <div className="flex flex-wrap gap-4">
          {['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl'].map((r) => (
            <div key={r} className={cn('flex size-24 items-end border border-line-strong bg-surface p-2 font-mono text-caption text-muted', r)}>
              {r}
            </div>
          ))}
          <div className="flex size-24 items-end rounded-lg bg-surface p-2 font-mono text-caption text-muted shadow-raised">shadow-raised</div>
          <div className="flex size-24 items-end rounded-lg bg-surface p-2 font-mono text-caption text-muted shadow-overlay">shadow-overlay</div>
        </div>
      </section>
    </div>
  )
}
