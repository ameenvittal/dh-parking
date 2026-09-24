import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, DoorOpen } from 'lucide-react'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { localName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { GateOption } from './useGateSelection'

type GateSwitcherProps = { gates: GateOption[]; gate: GateOption | null; onSelect: (id: string) => void }

/** Gate name in the top bar; opens a sheet with the gates this volunteer may use. */
export function GateSwitcher({ gates, gate, onSelect }: GateSwitcherProps) {
  const { t, i18n } = useTranslation('gate')
  const [open, setOpen] = useState(false)
  const name = gate ? localName(gate, i18n.language) : t('gate.home.noGate')
  if (gates.length <= 1) return <span>{name}</span>
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('gate.home.switchGate')}
        className="-ml-1 inline-flex min-h-11 max-w-full items-center gap-1 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span className="truncate">{name}</span>
        <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle>{t('gate.home.switchGate')}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="pb-6 pb-safe">
            <ul className="flex flex-col">
              {gates.map((g) => {
                const active = g.id === gate?.id
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(g.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex min-h-13 w-full items-center gap-3 rounded-md px-2 text-left text-body outline-none focus-visible:bg-surface-2',
                        active ? 'text-primary' : 'text-ink',
                      )}
                    >
                      <DoorOpen size={20} strokeWidth={1.75} aria-hidden="true" className={active ? 'text-primary' : 'text-muted'} />
                      <span className="flex-1">{localName(g, i18n.language)}</span>
                      {active ? <Check size={20} strokeWidth={1.75} aria-hidden="true" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  )
}
