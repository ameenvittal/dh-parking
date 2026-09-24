import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LogOut, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Label } from '@/components/ui/Label'
import { Separator } from '@/components/ui/Separator'
import { LanguageSwitch } from '@/components/common/LanguageSwitch'
import { DEMO_MODE } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'

type GateMenuSheetProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** Gate menu: language and log out (docs/07 section 3.1). */
export function GateMenuSheet({ open, onOpenChange }: GateMenuSheetProps) {
  const { t } = useTranslation('gate')
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{session?.fullName ?? t('gate.menu.title')}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4 pb-6 pb-safe">
          <div className="flex flex-col gap-2">
            <Label>{t('common.language')}</Label>
            <LanguageSwitch />
          </div>
          {DEMO_MODE ? (
            <>
              <Separator />
              <Button asChild variant="secondary" size="md" block>
                <a href="/sim" target="_blank" rel="noreferrer">
                  <MessageCircle size={20} strokeWidth={1.75} aria-hidden="true" />
                  {t('gate.done.simulator')}
                </a>
              </Button>
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
              void signOut().then(() => navigate('/login', { replace: true }))
            }}
          >
            {t('common.actions.logout')}
          </Button>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
