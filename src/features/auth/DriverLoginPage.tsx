import { zodResolver } from '@hookform/resolvers/zod'
import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router'
import { LanguageSwitch } from '@/components/common/LanguageSwitch'
import { MobileShell } from '@/components/shell/MobileShell'
import { StickyActionBar } from '@/components/shell/StickyActionBar'
import { TopBar } from '@/components/shell/TopBar'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { DEMO_MODE } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'
import { useErrorText } from '@/hooks/useErrorText'
import { errorCode } from '@/lib/errors'
import { formatPhoneInput } from '@/lib/phone'
import { driverPhoneSchema, type DriverPhoneInput } from '@/lib/schemas/auth'
import { cn } from '@/lib/utils'
import { requestDriverLink } from './api'

const RESEND_AFTER_S = 60
const FORM_ID = 'driver-login-form'
const nowMs = () => Date.now()

/** `/driver/login`: resend the parking link on WhatsApp (docs 07 section 1.3, F-DRV-02). */
export function DriverLoginPage() {
  const { t } = useTranslation(['driver', 'common'])
  const errorText = useErrorText()
  const { role } = useAuth()
  const [params] = useSearchParams()
  const expired = params.get('expired') === '1'
  const [sentAt, setSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(nowMs)
  const [error, setError] = useState<unknown>(null)

  const form = useForm<DriverPhoneInput>({ resolver: zodResolver(driverPhoneSchema), defaultValues: { phone: '' } })
  const { register, handleSubmit, formState, getValues, setValue, control } = form
  const phone = useWatch({ control, name: 'phone' })
  const digits = phone.replace(/\D/g, '')

  useEffect(() => {
    if (sentAt === null) return
    const id = window.setInterval(() => setNow(nowMs()), 1000)
    return () => window.clearInterval(id)
  }, [sentAt])

  useEffect(() => {
    document.title = `${t('driver.login.title')} | ${t('common.appName')}`
  }, [t])

  if (role === 'driver') return <Navigate to="/driver" replace />

  const send = async (raw: string) => {
    setError(null)
    try {
      await requestDriverLink(raw.replace(/\D/g, ''))
      setSentAt(nowMs())
      setNow(nowMs())
    } catch (err) {
      // Same confirmation whether or not the number exists; only rate limits and bad input show.
      if (errorCode(err) === 'RATE_LIMITED' || errorCode(err) === 'INVALID_PHONE') setError(err)
      else {
        setSentAt(nowMs())
        setNow(nowMs())
      }
    }
  }

  const onSubmit = handleSubmit(async (values) => send(values.phone))
  const left = sentAt === null ? 0 : Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / 1000))
  const phoneField = register('phone')
  const invalid = formState.errors.phone

  return (
    <MobileShell
      topBar={<TopBar title={t('common.appName')} trailing={<LanguageSwitch variant="short" size="sm" className="w-28" />} />}
      actionBar={
        <StickyActionBar>
          {sentAt === null ? (
            <Button
              type="submit"
              form={FORM_ID}
              size="lg"
              block
              loading={formState.isSubmitting}
              disabled={digits.length !== 10}
              icon={<MessageCircle size={20} strokeWidth={1.75} />}
            >
              {t('driver.login.send')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="md"
              block
              className="h-auto min-h-11 py-2 whitespace-normal"
              disabled={left > 0}
              onClick={() => void send(getValues('phone'))}>
              {left > 0 ? t('common.auth.sendAgainIn', { seconds: left }) : t('common.auth.sendAgain')}
            </Button>
          )}
        </StickyActionBar>
      }
    >
      <div className="flex flex-col gap-2 pt-2">
        <h1 className="text-h2 text-ink">{t('driver.login.title')}</h1>
        <p className="text-body text-muted">{t('driver.login.body')}</p>
      </div>

      {expired && sentAt === null ? <Alert tone="warning">{t('driver.login.expired')}</Alert> : null}
      {error ? <Alert tone="danger">{errorText(error)}</Alert> : null}

      {sentAt === null ? (
        <form id={FORM_ID} onSubmit={(e) => void onSubmit(e)} noValidate>
          <Field
            label={t('common.auth.mobileNumber')}
            htmlFor="phone"
            error={invalid ? t(invalid.message ?? 'errors.INVALID_PHONE') : undefined}
          >
            <div
              className={cn(
                'flex h-12 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-focus',
                invalid && 'border-danger',
              )}
            >
              <span className="flex items-center border-r border-line bg-surface-2 px-3 text-body font-semibold text-ink tabular-nums">
                {t('common.auth.countryCode')}
              </span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                placeholder="98765 43210"
                aria-invalid={invalid ? true : undefined}
                className="min-w-0 flex-1 bg-transparent px-3 text-body text-ink tabular-nums outline-none placeholder:text-subtle"
                {...phoneField}
                onChange={(e) => {
                  setValue('phone', formatPhoneInput(e.target.value), { shouldValidate: formState.isSubmitted })
                }}
              />
            </div>
          </Field>
        </form>
      ) : (
        <Alert tone="success" role="status" aria-live="polite">
          {t('driver.login.sent')}
        </Alert>
      )}

      {DEMO_MODE ? (
        <div className="mt-auto flex flex-col items-start gap-1 pt-4">
          <p className="text-body-sm text-muted">{t('common.auth.driverNoLink')}</p>
          <Button asChild variant="link" size="sm">
            <Link to="/sim">
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
              {t('common.auth.openWhatsApp')}
            </Link>
          </Button>
        </div>
      ) : null}
    </MobileShell>
  )
}
