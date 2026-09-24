import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { PlateChip } from '@/components/common/PlateChip'
import { vehicleTypeIcon } from '@/components/common/statusMeta'
import { useAuth } from '@/hooks/useAuth'
import { isValidIndianPlate, normalizePlate } from '@/lib/plate'
import { queryKeys } from '@/lib/queryKeys'
import { vehicleDetailsSchema, type VehicleDetailsInput } from '@/lib/schemas/gate'
import { cn } from '@/lib/utils'
import { VEHICLE_TYPES, VISITOR_CATEGORIES, type VisitSummary } from '@/types/domain'
import { findActiveVisitByPlate, getPhotoUrl } from '../api'
import { useCheckinStore } from '../store'
import { StepBody } from './StepBody'

const HIGH_CONFIDENCE = 0.85

type DetailsStepProps = { eventId: string; onOpenExisting: (visitId: string) => void }

/** Step 2: vehicle details (docs/07 section 3.2). */
export function DetailsStep({ eventId, onOpenExisting }: DetailsStepProps) {
  const { t } = useTranslation('gate')
  const qc = useQueryClient()
  const { role } = useAuth()
  const store = useCheckinStore()
  const ai = store.ai
  const [dup, setDup] = useState<VisitSummary | null>(null)
  const [checking, setChecking] = useState(false)
  const [more, setMore] = useState(Boolean(store.details.color || store.details.make || store.details.passNumber))

  const form = useForm<VehicleDetailsInput>({
    resolver: zodResolver(vehicleDetailsSchema),
    defaultValues: store.details,
    mode: 'onChange',
  })
  const plate = normalizePlate(form.watch('plateRaw') ?? '')
  const vehicleType = form.watch('vehicleType')
  const plateValid = isValidIndianPlate(plate)
  const lowConfidence = ai !== null && ai.plate_confidence < HIGH_CONFIDENCE
  const canNext = plate.length >= 4 && Boolean(vehicleType)

  const thumb = useQuery({
    queryKey: ['photoUrl', store.photoPaths[0] ?? ''],
    queryFn: () => getPhotoUrl(store.photoPaths[0] ?? ''),
    enabled: store.photoPaths.length > 0,
  })

  const checkDuplicate = async (p: string): Promise<VisitSummary | null> => {
    if (p.length < 4) return null
    setChecking(true)
    try {
      const found = await qc.fetchQuery({
        queryKey: queryKeys.activeVisitByPlate(eventId, p),
        queryFn: () => findActiveVisitByPlate(eventId, p),
        staleTime: 5_000,
      })
      setDup(found)
      return found
    } catch {
      return null
    } finally {
      setChecking(false)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const p = normalizePlate(values.plateRaw)
    const found = await checkDuplicate(p)
    if (found && !store.allowDuplicate) return
    store.setDetails({
      plateRaw: p,
      vehicleType: values.vehicleType,
      category: values.category,
      needsAccessible: values.needsAccessible,
      color: values.color.trim(),
      make: values.make.trim(),
      passNumber: values.passNumber.trim(),
      passHolderName: values.passHolderName.trim(),
    })
    store.setStep('phone')
  })

  const plateField = form.register('plateRaw', {
    onBlur: (e: { target: { value: string } }) => void checkDuplicate(normalizePlate(e.target.value)),
    onChange: () => setDup(null),
  })

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="contents" noValidate>
      <StepBody
        actions={
          <Button type="submit" size="lg" block disabled={!canNext} loading={checking && form.formState.isSubmitting}>
            {t('common.actions.next')}
          </Button>
        }
      >
        {store.aiStatus === 'failed' ? <Alert tone="warning">{t('errors.AI_FAILED')}</Alert> : null}
        {ai ? (
          <div className="flex items-center gap-3">
            {thumb.data ? (
              <img src={thumb.data} alt="" className="size-16 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="size-16 shrink-0 rounded-md bg-surface-2" />
            )}
            <div className="flex flex-col">
              <span className="text-body font-semibold text-ink">{t('gate.details.readByAi')}</span>
              <span className={cn('text-body-sm', lowConfidence ? 'text-warning' : 'text-success')}>
                {lowConfidence ? t('gate.details.checkPlate') : t('gate.details.highConfidence')}
              </span>
            </div>
          </div>
        ) : null}

        <Field
          label={t('gate.details.plateLabel')}
          htmlFor="plate"
          error={form.formState.errors.plateRaw ? t(form.formState.errors.plateRaw.message ?? '') : undefined}
        >
          <Input
            id="plate"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            warning={lowConfidence || (plate.length >= 4 && !plateValid)}
            className="h-14 font-display text-h2 tracking-wide uppercase"
            {...plateField}
          />
        </Field>
        {plate.length > 0 ? <PlateChip plate={plate} size="lg" className="-mt-2 self-start" /> : null}
        {plate.length >= 4 && !plateValid ? (
          <p className="-mt-2 text-body-sm text-warning" role="status">
            {t('gate.details.invalidPlate')}
          </p>
        ) : null}

        {dup ? (
          <Alert
            tone="warning"
            title={t('gate.details.alreadyIn', { slot: dup.slot_label ?? '' })}
            action={
              <>
                <Button type="button" variant="secondary" size="sm" onClick={() => onOpenExisting(dup.id)}>
                  {t('gate.details.openExisting')}
                </Button>
                {role === 'admin' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      store.patch({ allowDuplicate: true })
                      setDup(null)
                    }}
                  >
                    {t('gate.details.continueAnyway')}
                  </Button>
                ) : null}
              </>
            }
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Label>{t('gate.details.vehicleType')}</Label>
          <Controller
            control={form.control}
            name="vehicleType"
            render={({ field }) => (
              <SegmentedControl
                ariaLabel={t('gate.details.vehicleType')}
                stacked
                value={field.value}
                onChange={field.onChange}
                options={VEHICLE_TYPES.map((type) => {
                  const Icon = vehicleTypeIcon[type]
                  return {
                    value: type,
                    label: t(`common.enums.vehicleType.${type}`),
                    icon: <Icon size={20} strokeWidth={1.75} aria-hidden="true" />,
                  }
                })}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t('gate.details.category')}</Label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <div role="radiogroup" aria-label={t('gate.details.category')} className="flex flex-wrap gap-2">
                {VISITOR_CATEGORIES.map((c) => (
                  <Chip key={c} role="radio" aria-checked={field.value === c} selected={field.value === c} onClick={() => field.onChange(c)}>
                    {t(`common.enums.category.${c}`)}
                  </Chip>
                ))}
              </div>
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="needsAccessible"
          render={({ field }) => (
            <SwitchRow label={t('gate.details.accessible')} checked={field.value} onCheckedChange={field.onChange} />
          )}
        />

        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            className="flex min-h-11 items-center justify-between rounded-md text-left text-body font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t('gate.details.more')}
            <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" className={cn('text-muted transition-transform', more && 'rotate-180')} />
          </button>
          {more ? (
            <div className="flex flex-col gap-4">
              <Field label={t('gate.details.color')} htmlFor="color">
                <Input id="color" autoComplete="off" {...form.register('color')} />
              </Field>
              <Field label={t('gate.details.make')} htmlFor="make">
                <Input id="make" autoComplete="off" {...form.register('make')} />
              </Field>
              <Field label={t('gate.details.passNumber')} htmlFor="passNumber">
                <Input id="passNumber" autoComplete="off" {...form.register('passNumber')} />
              </Field>
              <Field label={t('gate.details.passHolder')} htmlFor="passHolder">
                <Input id="passHolder" autoComplete="off" {...form.register('passHolderName')} />
              </Field>
            </div>
          ) : null}
        </div>
      </StepBody>
    </form>
  )
}
