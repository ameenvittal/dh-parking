import { ScanLine, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type DemoAccount = { username: string; password: string; roleKey: string; icon: LucideIcon }

/** Seeded demo accounts (docs/01 decision 16). Shown only in demo mode. */
const ACCOUNTS: DemoAccount[] = [
  { username: 'admin', password: 'admin12345', roleKey: 'auth.demoRoles.admin', icon: ShieldCheck },
  { username: 'gate1', password: 'test12345', roleKey: 'auth.demoRoles.gate', icon: ScanLine },
  { username: 'zonea', password: 'test12345', roleKey: 'auth.demoRoles.zone', icon: UsersRound },
]

type DemoAccountsProps = { onPick: (username: string, password: string) => void }

/** Quick-fill chips on the staff login page. */
export function DemoAccounts({ onPick }: DemoAccountsProps) {
  const { t } = useTranslation('common')
  return (
    <section aria-labelledby="demo-accounts" className="flex flex-col gap-2">
      <h2 id="demo-accounts" className="text-body-sm font-semibold text-ink">
        {t('auth.demoAccounts')}
      </h2>
      <p className="text-body-sm text-muted">{t('auth.demoHint')}</p>
      <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {ACCOUNTS.map((a) => {
          const Icon = a.icon
          return (
            <li key={a.username} className="sm:flex-1">
              <button
                type="button"
                onClick={() => onPick(a.username, a.password)}
                className="flex h-12 w-full items-center gap-2.5 rounded-md border border-line-strong bg-surface px-3 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus sm:h-auto sm:flex-col sm:items-start sm:gap-1 sm:py-2.5"
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-ink">{t(a.roleKey)}</span>
                  <span className="block truncate font-mono text-caption text-muted">{a.username}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
