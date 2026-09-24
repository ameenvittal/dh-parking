import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { IconButton } from '@/components/shell/IconButton'
import { MobileShell } from '@/components/shell/MobileShell'
import { TopBar } from '@/components/shell/TopBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { DetailsStep } from './steps/DetailsStep'
import { DoneStep } from './steps/DoneStep'
import { PhoneStep } from './steps/PhoneStep'
import { PhotoStep } from './steps/PhotoStep'
import { SlotStep } from './steps/SlotStep'
import { useCheckinStore, type CheckinStep } from './store'
import { useGateContext } from './useGateContext'
import { VehicleActionSheet } from './VehicleActionSheet'

const STEP_NUMBERS: Record<Exclude<CheckinStep, 'done'>, number> = {
  photo: 1,
  details: 2,
  phone: 3,
  slot: 4,
}

/** Check-in wizard (docs/07 section 3.2). */
export function CheckinPage() {
  const { t } = useTranslation('gate')
  const navigate = useNavigate()
  const ctx = useGateContext({ withStatuses: true })
  const store = useCheckinStore()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [openVisit, setOpenVisit] = useState<string | null>(null)

  const step = store.step
  const isDone = step === 'done'
  const stepNum = !isDone ? STEP_NUMBERS[step] : null

  const handleDiscard = () => {
    store.reset()
    void navigate('/gate')
  }

  const handleBack = () => {
    if (step === 'details') store.setStep('photo')
    else if (step === 'phone') store.setStep('details')
    else if (step === 'slot') store.setStep('phone')
    else void navigate('/gate')
  }

  const topBar = (
    <div className="flex flex-col">
      <TopBar
        title={isDone ? t('gate.done.title') : t(`gate.checkin.steps.${step}`)}
        subtitle={stepNum ? t('gate.checkin.stepIndicator', { current: stepNum, total: 4 }) : undefined}
        back={!isDone && step !== 'photo' ? handleBack : undefined}
        leading={
          step === 'photo' ? (
            <IconButton
              label={t('common.actions.cancel')}
              icon={<X size={24} strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => void navigate('/gate')}
            />
          ) : undefined
        }
        trailing={
          isDone ? (
            <IconButton
              label={t('common.actions.close')}
              icon={<X size={24} strokeWidth={1.75} aria-hidden="true" />}
              onClick={handleDiscard}
            />
          ) : (
            <IconButton
              label={t('common.actions.cancel')}
              icon={<X size={24} strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => setDiscardOpen(true)}
            />
          )
        }
      />
      {stepNum ? (
        <div className="flex h-1 w-full bg-surface-2" role="progressbar" aria-valuenow={stepNum} aria-valuemin={1} aria-valuemax={4}>
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(stepNum / 4) * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  )

  const isReady = !ctx.isLoading && !ctx.error && Boolean(ctx.event && ctx.eventMap)

  let body = null
  if (ctx.isLoading) {
    body = (
      <div className="flex flex-col gap-4 p-4" aria-busy="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  } else if (ctx.error) {
    body = <ErrorState error={ctx.error} onRetry={ctx.refetch} className="p-4" />
  } else if (!ctx.event || !ctx.eventMap) {
    body = <EmptyState title={t('common.noLiveEvent')} description={t('common.noLiveEventBody')} className="py-16" />
  } else {
    body = (
      <>
        {step === 'photo' && <PhotoStep eventId={ctx.event.id} />}
        {step === 'details' && (
          <DetailsStep eventId={ctx.event.id} onOpenExisting={(id) => setOpenVisit(id)} />
        )}
        {step === 'phone' && <PhoneStep defaultLanguage={ctx.event.default_language ?? 'en'} />}
        {step === 'slot' && (
          <SlotStep event={ctx.event} eventMap={ctx.eventMap} gateId={ctx.gate?.id ?? ctx.gates[0]?.id ?? ''} />
        )}
        {step === 'done' && <DoneStep eventMap={ctx.eventMap} />}
      </>
    )
  }

  return (
    <>
      <MobileShell topBar={topBar} bleed={isReady} contentClassName={isReady ? 'max-w-none w-full' : undefined}>
        {body}
      </MobileShell>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('gate.checkin.discardTitle')}
        description={t('gate.checkin.discardBody')}
        confirmLabel={t('gate.checkin.discardConfirm')}
        tone="danger"
        onConfirm={handleDiscard}
      />

      <VehicleActionSheet
        visitId={openVisit}
        onOpenChange={(o) => (!o ? setOpenVisit(null) : undefined)}
        eventId={ctx.event?.id ?? ''}
        gateId={ctx.gate?.id ?? null}
      />
    </>
  )
}
