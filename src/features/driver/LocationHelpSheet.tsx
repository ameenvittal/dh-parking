import { useTranslation } from 'react-i18next'
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'

type LocationHelpSheetProps = { open: boolean; onOpenChange: (open: boolean) => void }

const CHROME_STEPS = ['chrome1', 'chrome2', 'chrome3'] as const
const SAFARI_STEPS = ['safari1', 'safari2', 'safari3'] as const

/** "How to turn it on": short steps for Chrome and Safari (docs/07 section 2.1). */
export function LocationHelpSheet({ open, onOpenChange }: LocationHelpSheetProps) {
  const { t } = useTranslation('driver')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('driver.locationHelp.title')}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-5 pb-8 pb-safe">
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-ink">{t('driver.locationHelp.chrome')}</h3>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-body text-muted">
              {CHROME_STEPS.map((k) => (
                <li key={k}>{t(`driver.locationHelp.${k}`)}</li>
              ))}
            </ol>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-ink">{t('driver.locationHelp.safari')}</h3>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-body text-muted">
              {SAFARI_STEPS.map((k) => (
                <li key={k}>{t(`driver.locationHelp.${k}`)}</li>
              ))}
            </ol>
          </section>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
