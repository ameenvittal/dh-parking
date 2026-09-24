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
    <section aria-labelledby="demo-accounts" className="flex flex-col gap-3">
      <div>
        <h2 id="demo-accounts" className="text-body-sm font-semibold text-ink">
          {t('auth.demoAccounts')}
        </h2>
        <p className="text-caption text-muted">{t('auth.demoHint')}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {ACCOUNTS.map((a) => {
          const Icon = a.icon
          return (
            <li key={a.username}>
              <button
                type="button"
                onClick={() => onPick(a.username, a.password)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 text-left shadow-raised outline-none transition-all hover:border-primary/40 hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-focus"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-body-sm font-semibold text-ink">{t(a.roleKey)}</span>
                    <span className="block truncate font-mono text-caption text-muted">{a.username}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-surface-2 px-2.5 py-1 text-caption font-medium text-muted transition-colors group-hover:bg-primary-soft group-hover:text-primary">
                  {t('auth.signIn')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
