import { Magnet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { useEditorStore } from './store'

type EditorStatusBarProps = {
  activeZoneCode: string | null
  totalSlots: number
}

export function EditorStatusBar({ activeZoneCode, totalSlots }: EditorStatusBarProps) {
  const { t } = useTranslation('admin')
  const { snapping, toggleSnapping, pointerCoord } = useEditorStore()

  return (
    <div className="flex h-9 items-center justify-between border-t border-line bg-surface px-4 text-caption text-muted select-none">
      {/* Left: Active zone & slots count */}
      <div className="flex items-center gap-4">
        <span className={cn('font-medium', activeZoneCode ? 'text-ink' : 'text-subtle')}>
          {activeZoneCode
            ? t('editor.status.activeZone', { code: activeZoneCode })
            : t('editor.status.noActiveZone')}
        </span>

        <span className="text-lineStrong">|</span>

        <span>{t('editor.status.slots', { count: totalSlots })}</span>
      </div>

      {/* Right: Snapping toggle & coordinates */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSnapping}
          className={cn(
            'h-7 px-2 text-caption gap-1.5 font-normal',
            snapping ? 'text-primary' : 'text-muted',
          )}
        >
          <Magnet size={14} aria-hidden="true" />
          <span>{snapping ? t('editor.status.snappingOn') : t('editor.status.snappingOff')}</span>
        </Button>

        <span className="text-lineStrong">|</span>

        <div className="w-36 font-mono text-right tabular-nums">
          {pointerCoord
            ? `${pointerCoord[0].toFixed(5)}, ${pointerCoord[1].toFixed(5)}`
            : '—, —'}
        </div>
      </div>
    </div>
  )
}
