import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { SlotLabel } from '@/components/common/SlotLabel'

type ArrivalSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slotLabel: string
  zoneColor: string | null
  zoneName: string | null
  marking: boolean
  onMarkParked: () => void
}

/** "You have arrived" sheet, shown once within the arrival radius (docs/07 section 2.3). */
export function ArrivalSheet({ open, onOpenChange, slotLabel, zoneColor, zoneName, marking, onMarkParked }: ArrivalSheetProps) {
  const { t } = useTranslation('driver')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="gap-3">
          <DrawerTitle className="text-h2">{t('driver.nav.arrived')}</DrawerTitle>
          <SlotLabel size="md" label={slotLabel} zoneColor={zoneColor} zoneName={zoneName} />
          <DrawerDescription>{t('driver.nav.parkThenTap', { slot: slotLabel })}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button size="lg" block loading={marking} onClick={onMarkParked}>
            {t('driver.markParked')}
          </Button>
          <Button variant="ghost" size="md" block onClick={() => onOpenChange(false)} disabled={marking}>
            {t('driver.nav.notYet')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
