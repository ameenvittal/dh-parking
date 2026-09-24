import {
  DoorOpen,
  Image,
  MapPin,
  MousePointer2,
  Rows3,
  Route,
  Shapes,
  Square,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { useEditorStore, type EditorTool } from './store'

type EditorToolbarProps = {
  onDeleteSelected: () => void
  hasSelection: boolean
}

type ToolItem = {
  id: EditorTool
  labelKey: string
  hintKey: string
  shortcut: string
  icon: typeof MousePointer2
}

const TOOLS: ToolItem[] = [
  { id: 'select', labelKey: 'editor.tools.select', hintKey: 'editor.toolHint.select', shortcut: 'V', icon: MousePointer2 },
  { id: 'zone', labelKey: 'editor.tools.zone', hintKey: 'editor.toolHint.zone', shortcut: 'Z', icon: Shapes },
  { id: 'slotRow', labelKey: 'editor.tools.slotRow', hintKey: 'editor.toolHint.slotRow', shortcut: 'R', icon: Rows3 },
  { id: 'slot', labelKey: 'editor.tools.slot', hintKey: 'editor.toolHint.slot', shortcut: 'S', icon: Square },
  { id: 'road', labelKey: 'editor.tools.road', hintKey: 'editor.toolHint.road', shortcut: 'D', icon: Route },
  { id: 'gate', labelKey: 'editor.tools.gate', hintKey: 'editor.toolHint.gate', shortcut: 'G', icon: DoorOpen },
  { id: 'landmark', labelKey: 'editor.tools.landmark', hintKey: 'editor.toolHint.landmark', shortcut: 'L', icon: MapPin },
  { id: 'overlay', labelKey: 'editor.tools.overlay', hintKey: 'editor.toolHint.overlay', shortcut: 'I', icon: Image },
]

export function EditorToolbar({ onDeleteSelected, hasSelection }: EditorToolbarProps) {
  const { t } = useTranslation('admin')
  const { tool, setTool } = useEditorStore()

  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label={t('editor.title')}
        className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-2"
      >
        {TOOLS.map((item) => {
          const Icon = item.icon
          const isActive = tool === item.id

          return (
            <Tooltip
              key={item.id}
              side="right"
              content={
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <span>{t(item.labelKey)}</span>
                    <kbd className="rounded bg-surface/20 px-1 py-0.5 text-[10px] uppercase text-on-primary">
                      {item.shortcut}
                    </kbd>
                  </div>
                  <span className="text-caption text-surface/80">{t(item.hintKey)}</span>
                </div>
              }
            >
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => setTool(item.id)}
                className={cn(
                  'flex size-11 items-center justify-center rounded-md text-ink transition-colors',
                  'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  isActive
                    ? 'bg-primary-soft text-primary font-semibold'
                    : 'text-muted hover:text-ink',
                )}
              >
                <Icon size={20} aria-hidden="true" />
              </button>
            </Tooltip>
          )
        })}

        <div className="my-1.5 h-px w-8 bg-line" />

        {/* Delete selected */}
        <Tooltip
          side="right"
          content={
            <div className="flex items-center gap-2 font-semibold">
              <span>{t('editor.tools.delete')}</span>
              <kbd className="rounded bg-surface/20 px-1 py-0.5 text-[10px] text-on-primary">
                ⌫
              </kbd>
            </div>
          }
        >
          <button
            type="button"
            disabled={!hasSelection}
            onClick={onDeleteSelected}
            className={cn(
              'flex size-11 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              hasSelection
                ? 'text-danger hover:bg-danger-soft'
                : 'cursor-not-allowed text-subtle opacity-50',
            )}
          >
            <Trash2 size={20} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
