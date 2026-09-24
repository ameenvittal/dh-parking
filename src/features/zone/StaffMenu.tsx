import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { LanguageSwitch } from '@/components/common/LanguageSwitch'
import { IconButton } from '@/components/shell/IconButton'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { useAuth } from '@/hooks/useAuth'

/** Top bar menu for zone screens: language and log out. */
export function StaffMenu() {
  const { t } = useTranslation(['common', 'zone'])
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label={t('actions.menu')} icon={<Menu size={24} strokeWidth={1.75} aria-hidden="true" />} onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{session?.fullName ?? t('actions.menu')}</DrawerTitle>
            {session?.username ? <DrawerDescription>{session.username}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-4">
            <p className="text-body-sm font-semibold text-ink">{t('language')}</p>
            <LanguageSwitch />
          </div>
          <DrawerFooter>
            <Button
              variant="secondary"
              size="lg"
              block
              icon={<LogOut size={20} strokeWidth={1.75} aria-hidden="true" />}
              onClick={() => {
                setOpen(false)
                void signOut().then(() => navigate('/login', { replace: true }))
              }}
            >
              {t('actions.logout')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
