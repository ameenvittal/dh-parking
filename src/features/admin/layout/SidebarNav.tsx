import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { ADMIN_NAV } from './navItems'

type SidebarNavProps = {
  collapsed?: boolean
  alertCount: number
  sos: boolean
  onNavigate?: () => void
}

/** Nav list shared by the desktop sidebar and the phone sheet. Items 40 px, icon 18 px (docs 06 section 5.2). */
export function SidebarNav({ collapsed = false, alertCount, sos, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation('common')
  return (
    <ul className="flex flex-col gap-0.5">
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon
        const label = t(item.labelKey)
        const badge = item.alerts && alertCount > 0 ? alertCount : 0
        const link = (
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            aria-label={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex h-11 items-center gap-3 rounded-md px-3 text-body font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus lg:h-10 lg:text-body-sm',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-surface-2',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" className={isActive ? 'text-primary' : 'text-muted'} />
                {collapsed ? null : <span className="min-w-0 flex-1 truncate">{label}</span>}
                {badge ? (
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption tabular-nums',
                      sos ? 'bg-danger text-on-primary' : 'bg-warning-soft text-warning',
                      collapsed && 'absolute top-0.5 right-1 h-4 min-w-4 px-1',
                    )}
                  >
                    {badge > 99 ? '99' : badge}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        )
        return (
          <li key={item.to}>
            {collapsed ? (
              <Tooltip content={label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            )}
          </li>
        )
      })}
    </ul>
  )
}
