import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { IconButton } from '@/components/shell/IconButton'
import { MobileShell } from '@/components/shell/MobileShell'
import { TopBar } from '@/components/shell/TopBar'
import type { EventMapData, EventRow, SlotStatus } from '@/types/domain'
import { GateMenuSheet } from './GateMenuSheet'
import { GateNav } from './GateNav'
import { GateSwitcher } from './GateSwitcher'
import { useGateContext } from './useGateContext'
import type { GateOption } from './useGateSelection'

export type GateCtx = {
  event: EventRow
  eventMap: EventMapData
  gate: GateOption | null
  gates: GateOption[]
  slotStatuses: Map<string, SlotStatus> | undefined
}

type GateFrameProps = {
  /** Page title; the gate switcher is used when omitted (gate home). */
  title?: ReactNode
  back?: string
  withStatuses?: boolean
  children: (ctx: GateCtx) => ReactNode
}

/**
 * Frame for gate top-level pages: top bar with the live event name, bottom nav, and the
 * shared loading, error and "No event is live right now" states (docs/07 section 0).
 */
export function GateFrame({ title, back, withStatuses = false, children }: GateFrameProps) {
  const { t } = useTranslation('gate')
  const ctx = useGateContext({ withStatuses })
  const [menuOpen, setMenuOpen] = useState(false)

  const topBar = (
    <TopBar
      title={title ?? <GateSwitcher gates={ctx.gates} gate={ctx.gate} onSelect={ctx.selectGate} />}
      subtitle={ctx.event?.name}
      back={back}
      trailing={
        <IconButton
          label={t('common.actions.menu')}
          onClick={() => setMenuOpen(true)}
          icon={<Menu size={24} strokeWidth={1.75} aria-hidden="true" />}
        />
      }
    />
  )

  let body: ReactNode
  if (ctx.isLoading) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-13 w-full" />
        <Skeleton className="h-13 w-full" />
        <Skeleton className="h-13 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  } else if (ctx.error) {
    body = <ErrorState error={ctx.error} onRetry={ctx.refetch} />
  } else if (!ctx.event || !ctx.eventMap) {
    body = <EmptyState title={t('common.noLiveEvent')} description={t('common.noLiveEventBody')} className="py-16" />
  } else {
    body = children({
      event: ctx.event,
      eventMap: ctx.eventMap,
      gate: ctx.gate,
      gates: ctx.gates,
      slotStatuses: ctx.slotStatuses,
    })
  }

  return (
    <>
      <MobileShell topBar={topBar} bottomNav={<GateNav />}>
        {body}
      </MobileShell>
      <GateMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}
