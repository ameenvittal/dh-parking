import { useTranslation } from 'react-i18next'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatPhoneInput, normalizeIndianPhone } from '@/lib/phone'
import { driverPhoneStepSchema, type DriverPhoneStepInput } from '@/lib/schemas/gate'
import type { Language } from '@/types/domain'
import { useCheckinStore } from '../store'
import { StepBody } from './StepBody'

/** Step 3: driver phone, optional name, message language (docs/07 section 3.2). */
export function PhoneStep({ defaultLanguage }: { defaultLanguage: Language }) {
  const { t } = useTranslation('gate')
  const store = useCheckinStore()
  const form = useForm<DriverPhoneStepInput>({
    resolver: zodResolver(driverPhoneStepSchema),
    defaultValues: {
      number: store.phone.number,
      name: store.phone.name,
      language: store.phone.number ? store.phone.language : defaultLanguage,
    },
    mode: 'onTouched',
  })
  const number = form.watch('number')
  const valid = normalizeIndianPhone(number ?? '') !== null
  const error = form.formState.errors.number

  const onSubmit = form.handleSubmit((values) => {
    store.patch({
      phone: { number: values.number.replace(/\D/g, ''), name: values.name.trim(), language: values.language },
    })
    store.setStep('slot')
  })

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="contents" noValidate>
      <StepBody
        actions={
          <Button type="submit" size="lg" block disabled={!valid}>
            {t('common.actions.next')}
          </Button>
        }
      >
        <Field
          label={t('gate.phone.label')}
          htmlFor="driver-phone"
          helper={t('gate.phone.helper')}
          error={error ? t(error.message ?? 'errors.INVALID_PHONE') : undefined}
        >
          <div className="flex items-stretch">
            <span className="flex h-12 items-center rounded-l-md border border-r-0 border-line-strong bg-surface-2 px-3 text-body text-muted tabular-nums">
              {t('common.auth.countryCode')}
            </span>
            <Controller
              control={form.control}
              name="number"
              render={({ field }) => (
                <Input
                  id="driver-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  invalid={Boolean(error)}
                  className="rounded-l-none text-h3 tracking-wide tabular-nums"
                  value={formatPhoneInput(field.value ?? '')}
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
        </Field>

        <Field label={t('gate.phone.name')} htmlFor="driver-name">
          <Input id="driver-name" autoComplete="name" {...form.register('name')} />
        </Field>

        <div className="flex flex-col gap-2">
          <Label>{t('gate.phone.language')}</Label>
          <Controller
            control={form.control}
            name="language"
            render={({ field }) => (
              <SegmentedControl<Language>
                ariaLabel={t('gate.phone.language')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'en', label: <span lang="en">{t('common.languages.en')}</span> },
                  { value: 'ml', label: <span lang="ml">{t('common.languages.ml')}</span> },
                ]}
              />
            )}
          />
        </div>
      </StepBody>
    </form>
  )
}
