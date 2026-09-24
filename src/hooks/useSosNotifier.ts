import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listAlerts } from '@/features/admin/alerts/api'
import { formatPlate } from '@/lib/format'
import { playSosAlarm, vibrateEmergency } from '@/lib/sound'
import { useRealtime } from '@/lib/realtime'
import type { AlertView, StaffRole } from '@/types/domain'

type UseSosNotifierOptions = {
  eventId: string | null
  role: StaffRole
  zoneIds?: string[]
  onAction?: (alert: AlertView) => void
}

/**
 * Listens to realtime SOS alerts for staff (admin, gate, zone),
 * triggers audio beep + vibration, shows prominent toast, and returns open SOS alerts.
 */
export function useSosNotifier({ eventId, role, zoneIds, onAction }: UseSosNotifierOptions) {
  const { t } = useTranslation('common')
  const qc = useQueryClient()
  const queryKey = ['sos-open-alerts', eventId ?? '', role, (zoneIds ?? []).sort().join(',')]

  const alertsQuery = useQuery({
    queryKey,
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!eventId) return []
      const alerts = await listAlerts({
        eventId,
        status: 'open',
        types: ['sos'],
      })
      return alerts
    },
    staleTime: 3000,
  })

  useRealtime(['alerts'], () => {
    if (eventId) void qc.invalidateQueries({ queryKey })
  })

  const seenSosIds = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!alertsQuery.data) return
    const current = alertsQuery.data
    const currentIds = new Set(current.map((a) => a.id))

    if (seenSosIds.current === null) {
      // First load: seed with existing open alerts so we don't falsely alarm on initial load
      seenSosIds.current = currentIds
      return
    }

    const fresh = current.filter((a) => !seenSosIds.current?.has(a.id))
    if (fresh.length > 0) {
      // Trigger sound and haptic vibration for emergency alert
      playSosAlarm()
      vibrateEmergency()

      // Show high-priority toast
      for (const alert of fresh) {
        const reasonKey = alert.sos_reason ?? 'other'
        const reason = t(`sosReason.${reasonKey}`, { defaultValue: reasonKey })
        const plate = alert.plate ? formatPlate(alert.plate) : t('sosEmergency.unknownVehicle')
        const loc = [
          alert.slot_label ? `Slot ${alert.slot_label}` : null,
          alert.zone_code ? `Zone ${alert.zone_code}` : null,
        ]
          .filter(Boolean)
          .join(' · ')

        toast.error(t('sosEmergency.toast', { reason, plate }), {
          description: loc ? `${loc}${alert.message ? ` — ${alert.message}` : ''}` : alert.message ?? undefined,
          duration: 15000,
          action: onAction
            ? {
                label: role === 'zone_volunteer' ? t('sosEmergency.viewVehicle') : t('sosEmergency.viewAlert'),
                onClick: () => onAction(alert),
              }
            : undefined,
        })
      }
    }

    seenSosIds.current = currentIds
  }, [alertsQuery.data, onAction, role, t])

  return {
    openSosAlerts: alertsQuery.data ?? [],
    hasOpenSos: (alertsQuery.data?.length ?? 0) > 0,
    playSosAlarm,
  }
}
