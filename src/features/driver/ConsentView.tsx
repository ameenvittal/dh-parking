import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SlotLabel } from '@/components/common/SlotLabel'
import { MobileShell } from '@/components/shell/MobileShell'
import { StickyActionBar } from '@/components/shell/StickyActionBar'
import { TopBar } from '@/components/shell/TopBar'
import { localName } from '@/lib/format'
import type { DriverVisit } from '@/types/domain'
import { SosButton } from './SosButton'

type ConsentViewProps = {
  visit: DriverVisit
  onAllow: () => void
  onSkip: () => void
  allowing: boolean
  onSos: () => void
}

/** docs/07 section 2.1: location consent, shown inside /driver until the driver chooses. */
export function ConsentView({ visit, onAllow, onSkip, allowing, onSos }: ConsentViewProps) {
  const { t, i18n } = useTranslation('driver')
  return (
    <MobileShell
      topBar={<TopBar title={t('driver.title')} trailing={<SosButton onClick={onSos} />} />}
      actionBar={
        <StickyActionBar>
          <Button size="lg" block loading={allowing} onClick={onAllow}>
            {t('driver.consent.allow')}
          </Button>
          <Button variant="ghost" size="md" block onClick={onSkip} disabled={allowing}>
            {t('driver.consent.skip')}
          </Button>
        </StickyActionBar>
      }
    >
      {visit.slot ? (
        <SlotLabel
          size="xl"
          label={visit.slot.label}
          zoneColor={visit.zone?.color}
          zoneName={visit.zone ? localName(visit.zone, i18n.language) : null}
          accessible={visit.slot.is_accessible}
          className="mt-2"
        />
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        <h2 className="text-h3 text-ink">{t('driver.consent.title')}</h2>
        <p className="text-body text-muted">{t('driver.consent.body')}</p>
      </div>
    </MobileShell>
  )
}
