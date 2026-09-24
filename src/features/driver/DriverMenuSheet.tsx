import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LogOut, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Label } from '@/components/ui/Label'
import { Separator } from '@/components/ui/Separator'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { LanguageSwitch } from '@/components/common/LanguageSwitch'
import { useAuth } from '@/hooks/useAuth'
import { formatPhone } from '@/lib/phone'
import { setMyLanguage } from './api'
import { useDriverPrefs } from './driverPrefs'

type DriverMenuSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sharing switch shows only while the visit is active and not confirmed. */
  showSharing: boolean
  emergencyPhone: string | null
}

/** Top-left menu (docs/07 section 2.2): language, location sharing, help line, log out. */
export function DriverMenuSheet({ open, onOpenChange, showSharing, emergencyPhone }: DriverMenuSheetProps) {
  const { t } = useTranslation('driver')
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const sharing = useDriverPrefs((s) => s.sharing)
  const setSharing = useDriverPrefs((s) => s.setSharing)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('driver.menu.title')}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4 pb-6 pb-safe">
          <div className="flex flex-col gap-2">
            <Label>{t('common.language')}</Label>
            <LanguageSwitch onChange={(lng) => void setMyLanguage(lng).catch(() => undefined)} />
          </div>
          {showSharing ? (
            <>
              <Separator />
              <SwitchRow
                label={t('driver.menu.sharing')}
                description={sharing ? t('driver.menu.sharingOn') : t('driver.menu.sharingOff')}
                checked={sharing}
                onCheckedChange={setSharing}
              />
            </>
          ) : null}
          {emergencyPhone ? (
            <>
              <Separator />
              <a
                href={`tel:${emergencyPhone}`}
                className="flex min-h-12 items-center gap-3 rounded-md text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <Phone size={20} strokeWidth={1.75} className="text-muted" aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-body">{t('driver.menu.helpLine')}</span>
                  <span className="text-body-sm text-muted tabular-nums">{formatPhone(emergencyPhone)}</span>
                </span>
              </a>
            </>
          ) : null}
          <Separator />
          <Button
            variant="secondary"
            size="md"
            block
            icon={<LogOut size={20} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => {
              onOpenChange(false)
              void signOut().then(() => navigate('/driver/login', { replace: true }))
            }}
          >
            {t('common.actions.logout')}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
