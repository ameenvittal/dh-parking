import type { ReactNode } from 'react'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/Sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'

type DetailPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Rendered next to the title (status badge). */
  headerExtra?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Admin detail drawer: right side 520 px on wide screens, bottom sheet on phones (docs/06 section 6). */
export function DetailPanel({ open, onOpenChange, title, description, headerExtra, children, footer }: DetailPanelProps) {
  const wide = useMediaQuery('(min-width: 768px)')
  if (wide) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" aria-describedby={undefined}>
          <SheetHeader>
            <div className="flex flex-wrap items-center gap-3">
              <SheetTitle>{title}</SheetTitle>
              {headerExtra}
            </div>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <SheetBody className="flex flex-col gap-6">{children}</SheetBody>
          {footer ? <SheetFooter className="justify-start">{footer}</SheetFooter> : null}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-11/12" aria-describedby={undefined}>
        <DrawerHeader>
          <div className="flex flex-wrap items-center gap-3">
            <DrawerTitle>{title}</DrawerTitle>
            {headerExtra}
          </div>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">{children}</DrawerBody>
        {footer ? <DrawerFooter>{footer}</DrawerFooter> : null}
      </DrawerContent>
    </Drawer>
  )
}

/** Titled block inside a detail panel. */
export function PanelSection({ title, children, action }: { title: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-body-sm font-semibold text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
