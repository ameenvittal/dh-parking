import { Download, LogOut, MessageCircle, ScanLine, UserRound, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { DEMO_MODE } from '@/config/app'
import { useAuth } from '@/hooks/useAuth'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

/** Name, gate and zone screens, install, log out. Admin is English only, so no language switch here. */
export function AccountMenu() {
  const { t } = useTranslation('common')
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { canInstall, install } = useInstallPrompt()
  const name = session?.fullName ?? ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('shell.account')}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-1.5 outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:h-9 lg:px-2"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-2 text-muted lg:size-7">
          <UserRound size={18} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="hidden max-w-32 truncate text-body-sm font-semibold text-ink xl:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold text-ink">{name}</span>
          {session ? <span className="text-caption text-muted">{t(`enums.role.${session.role}`)}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate('/gate')}>
          <ScanLine strokeWidth={1.75} aria-hidden="true" />
          {t('adminNav.gateScreens')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void navigate('/zone')}>
          <UsersRound strokeWidth={1.75} aria-hidden="true" />
          {t('adminNav.zoneScreens')}
        </DropdownMenuItem>
        {DEMO_MODE ? (
          <DropdownMenuItem onSelect={() => window.open('/sim', '_blank', 'noopener')}>
            <MessageCircle strokeWidth={1.75} aria-hidden="true" />
            {t('adminNav.whatsappSim')}
          </DropdownMenuItem>
        ) : null}
        {canInstall ? (
          <DropdownMenuItem onSelect={() => void install()}>
            <Download strokeWidth={1.75} aria-hidden="true" />
            {t('actions.installApp')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void signOut().then(() => navigate('/login', { replace: true }))
          }}
        >
          <LogOut strokeWidth={1.75} aria-hidden="true" />
          {t('actions.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
