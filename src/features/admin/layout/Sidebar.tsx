import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'
import { SidebarNav } from './SidebarNav'

type SidebarProps = {
  collapsed: boolean
  onToggle: () => void
  alertCount: number
  sos: boolean
}

/** Desktop sidebar: 232 px, icons only (64 px) below 1200 px or when collapsed (docs 06 section 5.2). */
export function Sidebar({ collapsed, onToggle, alertCount, sos }: SidebarProps) {
  const { t } = useTranslation('common')
  const toggleLabel = collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-line bg-surface transition-all duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-58',
      )}
    >
      <div className={cn('flex h-14 shrink-0 items-center border-b border-line', collapsed ? 'justify-center' : 'px-4')}>
        <Link to="/admin" className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <BrandMark withName={!collapsed} />
        </Link>
      </div>
      <nav aria-label={t('shell.mainNav')} className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        <SidebarNav collapsed={collapsed} alertCount={alertCount} sos={sos} />
      </nav>
      <div className={cn('shrink-0 border-t border-line p-2', collapsed ? 'flex justify-center' : '')}>
        <Tooltip content={collapsed ? toggleLabel : null} side="right">
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            className={cn(
              'flex h-9 items-center gap-3 rounded-md px-3 text-body-sm font-semibold text-muted outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-focus',
              collapsed ? 'w-9 justify-center px-0' : 'w-full',
            )}
          >
            <ToggleIcon size={18} strokeWidth={1.75} aria-hidden="true" />
            {collapsed ? null : <span>{toggleLabel}</span>}
          </button>
        </Tooltip>
      </div>
    </aside>
  )
}
