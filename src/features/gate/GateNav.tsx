import { useTranslation } from 'react-i18next'
import { Camera, House, LogOut, Search } from 'lucide-react'
import { BottomNav } from '@/components/shell/BottomNav'

/** Bottom nav on gate top-level pages only (not inside the check-in wizard). */
export function GateNav() {
  const { t } = useTranslation('gate')
  return (
    <BottomNav
      ariaLabel={t('gate.nav.label')}
      items={[
        { to: '/gate', label: t('gate.nav.home'), icon: House, end: true },
        { to: '/gate/checkin', label: t('gate.nav.checkIn'), icon: Camera },
        { to: '/gate/exit', label: t('gate.nav.leaving'), icon: LogOut },
        { to: '/gate/vehicles', label: t('gate.nav.find'), icon: Search },
      ]}
    />
  )
}
