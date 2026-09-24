import { ArrowRight, Phone, Siren } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { formatPlate } from '@/lib/format'
import type { AlertView, StaffRole } from '@/types/domain'

type SosEmergencyBannerProps = {
  alerts: AlertView[]
  role: StaffRole
  emergencyPhone?: string | null
  className?: string
}

/**
 * High-visibility banner for active unresolved SOS alerts,
 * displayed at top of staff interfaces (admin, gate, zone).
 */
export function SosEmergencyBanner({ alerts, role, emergencyPhone, className }: SosEmergencyBannerProps) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()

  if (!alerts || alerts.length === 0) return null

  const latest = alerts[0]
  const count = alerts.length
  const reasonKey = latest.sos_reason ?? 'other'
  const reason = t(`sosReason.${reasonKey}`, { defaultValue: reasonKey })
  const plate = latest.plate ? formatPlate(latest.plate) : t('sosEmergency.unknownVehicle')
  const location = [
    latest.slot_label ? `Slot ${latest.slot_label}` : null,
    latest.zone_code ? `Zone ${latest.zone_code}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const handleAction = () => {
    if (role === 'admin') {
      void navigate(`/admin/alerts?id=${latest.id}`)
    } else if (role === 'zone_volunteer' && latest.visit_id) {
      void navigate(`/zone/visit/${latest.visit_id}`)
    } else if (role === 'gate_volunteer' && latest.plate) {
      void navigate(`/gate/vehicles?q=${encodeURIComponent(latest.plate)}`)
    }
  }

  const phone = latest.driver_phone ?? emergencyPhone

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-danger/20 bg-danger-soft px-4 py-2.5 text-danger ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danger text-on-danger shadow-sm">
          <Siren size={16} strokeWidth={2.2} className="animate-pulse" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold text-body-sm text-danger">
            {t('sosEmergency.title')}
            {count > 1 ? ` (${count})` : ''}:
          </span>
          <span className="truncate text-body-sm font-medium text-ink">
            {reason} — {plate}
            {location ? ` (${location})` : ''}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {phone ? (
          <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 border-line bg-surface text-caption text-ink shadow-sm">
            <a href={`tel:${phone}`}>
              <Phone size={14} strokeWidth={2} className="text-danger" aria-hidden="true" />
              <span>{phone}</span>
            </a>
          </Button>
        ) : null}

        <Button
          variant="danger"
          size="sm"
          onClick={handleAction}
          className="h-8 gap-1 px-3 text-caption font-semibold"
        >
          <span>{role === 'zone_volunteer' ? t('sosEmergency.viewVehicle') : t('sosEmergency.viewAlert')}</span>
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
