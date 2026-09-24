import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type PaginationProps = { page: number; pageSize: number; total: number; onPage: (page: number) => void }

/** "1 to 50 of 328" with previous and next, bottom right (docs/06 section 6). */
export function Pagination({ page, pageSize, total, onPage }: PaginationProps) {
  const { t } = useTranslation('admin')
  if (total === 0) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  const last = Math.max(0, Math.ceil(total / pageSize) - 1)
  const btn =
    'inline-flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 lg:size-9'
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="text-body-sm text-muted tabular-nums">{t('admin.shared.pagination', { from, to, total })}</span>
      <button type="button" className={btn} aria-label={t('admin.shared.previousPage')} disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" className={btn} aria-label={t('admin.shared.nextPage')} disabled={page >= last} onClick={() => onPage(page + 1)}>
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
