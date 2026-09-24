import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import { DEMO_MODE } from '@/config/app'
import { BrandMark } from '@/features/admin/layout/BrandMark'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useErrorText } from '@/hooks/useErrorText'
import { staffLoginSchema, type StaffLoginValues } from '@/lib/schemas/auth'
import { staffSignIn } from './api'
import { DemoAccounts } from './DemoAccounts'

function fromState(state: unknown): string | null {
  if (state && typeof state === 'object' && 'from' in state && typeof state.from === 'string') return state.from
  return null
}

/** `/login` (docs 07 section 1.1). */
export function StaffLoginPage() {
  const { t } = useTranslation('common')
  const errorText = useErrorText()
  const { role, refresh } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const form = useForm<StaffLoginValues>({
    resolver: zodResolver(staffLoginSchema),
    defaultValues: { username: '', password: '' },
  })
  const { register, handleSubmit, setValue, formState } = form

  useEffect(() => {
    document.title = `${t('auth.staffSignIn')} | ${t('appName')}`
  }, [t])

  if (role && role !== 'driver') return <Navigate to={homePathFor(role)} replace />

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const session = await staffSignIn(values)
      refresh()
      const from = fromState(location.state)
      const home = homePathFor(session.role)
      const target = from && (session.role === 'admin' || from.startsWith(home)) ? from : home
      void navigate(target, { replace: true })
    } catch (err) {
      setError(err)
    }
  })

  const pick = (username: string, password: string) => {
    setValue('username', username, { shouldValidate: false })
    setValue('password', password, { shouldValidate: false })
    setError(null)
  }

  const usernameField = register('username')

  return (
    <div className="flex min-h-app flex-col bg-surface sm:bg-canvas">
      <OfflineBanner />
      <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-4 py-8 pb-safe sm:py-12">
        <div className="flex flex-col gap-6 sm:rounded-lg sm:border sm:border-line sm:bg-surface sm:p-6">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-h2 text-ink">{t('appName')}</h1>
              <p className="text-body text-muted">{t('auth.staffSignIn')}</p>
            </div>
            <BrandMark withName={false} />
          </header>

          <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
            {error ? <Alert tone="danger">{errorText(error)}</Alert> : null}
            <Field label={t('auth.username')} htmlFor="username">
              <Input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                invalid={!!formState.errors.username}
                {...usernameField}
                onChange={(e) => {
                  e.target.value = e.target.value.toLowerCase()
                  void usernameField.onChange(e)
                }}
              />
            </Field>
            <Field label={t('auth.password')} htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-12"
                  invalid={!!formState.errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showPassword}
                  className="absolute top-0 right-0 inline-flex size-12 items-center justify-center rounded-md text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus lg:size-10"
                >
                  {showPassword ? (
                    <EyeOff size={20} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Eye size={20} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" block loading={formState.isSubmitting} className="mt-2">
              {t('auth.signIn')}
            </Button>
          </form>

          {DEMO_MODE ? (
            <>
              <Separator />
              <DemoAccounts onPick={pick} />
            </>
          ) : null}
        </div>
      </main>
    </div>
  )
}
