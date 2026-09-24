import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { setLanguage } from '@/lib/i18n'
import { errorCode } from '@/lib/errors'
import { exchangeDriverToken } from './api'

/** `/d/:token`: exchange the WhatsApp link token for a driver session (docs 07 section 1.2). */
export function DriverTokenPage() {
  const { t } = useTranslation('driver')
  const { token } = useParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const run = async () => {
      if (!token) {
        void navigate('/driver/login?expired=1', { replace: true })
        return
      }
      try {
        const result = await exchangeDriverToken(token)
        // The raw token leaves the address bar and history.
        window.history.replaceState(null, '', '/driver')
        await setLanguage(result.language)
        refresh()
        void navigate('/driver', { replace: true })
      } catch (err) {
        const code = errorCode(err)
        void navigate(code === 'RATE_LIMITED' ? '/driver/login' : '/driver/login?expired=1', { replace: true })
      }
    }
    void run()
  }, [token, navigate, refresh])

  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-3 bg-canvas px-6 text-center" role="status" aria-live="polite">
      <Spinner size={24} className="text-primary" />
      <p className="text-body text-ink">{t('driver.opening')}</p>
    </div>
  )
}
