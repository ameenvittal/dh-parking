import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { RadioGroup, RadioRow } from '@/components/ui/RadioGroup'
import { Textarea } from '@/components/ui/Textarea'
import { ErrorState } from '@/components/common/ErrorState'
import { queryKeys } from '@/lib/queryKeys'
import { SOS_REASONS, type SosReason } from '@/types/domain'
import { raiseSos } from './api'
import { useLastFix } from './useLiveLocation'

type SosSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  emergencyPhone: string | null
  /** An SOS is already open for this driver: show the sent state instead of the form. */
  alreadyOpen: boolean
}

/** docs/07 section 2.5. */
export function SosSheet({ open, onOpenChange, emergencyPhone, alreadyOpen }: SosSheetProps) {
  const fix = useLastFix()
  const { t } = useTranslation('driver')
  const qc = useQueryClient()
  const [reason, setReason] = useState<SosReason | ''>('')
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState<string | null>(null)

  const send = useMutation({
    mutationFn: () =>
      raiseSos({
        reason: reason || 'other',
        message: note.trim() || null,
        lng: fix?.lng ?? null,
        lat: fix?.lat ?? null,
      }),
    onSuccess: (res) => {
      setPhone(res.emergency_phone)
      void qc.invalidateQueries({ queryKey: queryKeys.myVisit() })
    },
  })

  const sent = alreadyOpen || send.isSuccess
  const helpLine = phone ?? emergencyPhone

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('driver.sos.title')}</DrawerTitle>
          {sent ? null : <DrawerDescription>{t('driver.sos.body')}</DrawerDescription>}
        </DrawerHeader>
        <DrawerBody>
          {sent ? (
            <div role="status" className="flex items-start gap-3 rounded-lg bg-success-soft p-4">
              <CircleCheck size={24} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-body text-ink">{t('driver.sos.sent')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-1 text-body-sm font-semibold text-ink">{t('driver.sos.whatHappened')}</legend>
                <RadioGroup value={reason} onValueChange={(v) => setReason(v as SosReason)} aria-label={t('driver.sos.whatHappened')}>
                  {SOS_REASONS.map((r) => (
                    <RadioRow key={r} value={r} label={t(`driver.sos.reason.${r}`)} />
                  ))}
                </RadioGroup>
              </fieldset>
              <Field label={t('driver.sos.noteLabel')} htmlFor="sos-note">
                <Textarea id="sos-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
              </Field>
              {send.isError ? <ErrorState error={send.error} onRetry={() => send.mutate()} /> : null}
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          {sent ? null : (
            <Button variant="danger" size="lg" block loading={send.isPending} disabled={!reason} onClick={() => send.mutate()}>
              {t('driver.sos.send')}
            </Button>
          )}
          {helpLine ? (
            <Button asChild variant="secondary" size="md" block>
              <a href={`tel:${helpLine}`}>
                <Phone size={20} strokeWidth={1.75} aria-hidden="true" />
                {t('driver.sos.callHelpline')}
              </a>
            </Button>
          ) : null}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
