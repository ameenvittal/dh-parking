import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as turf from '@turf/turf'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CarFront,
  FlaskConical,
  MapPin,
  MessageCircle,
  RotateCcw,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/Drawer'
import { Separator } from '@/components/ui/Separator'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { DEMO_MODE } from '@/config/app'
import { useErrorText } from '@/hooks/useErrorText'
import { addSampleTraffic, getDemoPlaces, resetDemo } from './api'
import { useDemoGps, type DemoFix } from './demoGps'

const ICON = { size: 20, strokeWidth: 1.75 } as const

function fixAt(lngLat: [number, number], heading: number | null = null): DemoFix {
  return { lng: lngLat[0], lat: lngLat[1], accuracy: 8, heading, speed: null, at: Date.now() }
}

/**
 * Small floating button (demo mode only) with the demo tools: WhatsApp simulator,
 * sample traffic, reset, and simulated GPS for this tab.
 */
export function DemoDock() {
  const { t } = useTranslation('sim')
  const errorText = useErrorText()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const gps = useDemoGps()

  const traffic = useMutation({
    mutationFn: () => addSampleTraffic(120),
    onSuccess: (r) => {
      toast.success(t('dock.addTrafficDone', { count: r.added }))
      void qc.invalidateQueries()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const reset = useMutation({
    mutationFn: resetDemo,
    onSuccess: () => {
      toast.success(t('dock.resetDone'))
      void qc.invalidateQueries()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const jump = async (place: 'gate' | 'mySlot') => {
    try {
      const places = await getDemoPlaces()
      const target = places[place]
      if (target) {
        gps.setEnabled(true)
        gps.setPosition(fixAt(target))
      }
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const nudge = (bearing: number) => {
    const from = gps.position
    if (!from) return
    const to = turf.destination(turf.point([from.lng, from.lat]), 10, bearing, { units: 'meters' }).geometry.coordinates
    gps.setPosition(fixAt([to[0], to[1]], bearing))
  }

  if (!DEMO_MODE) return null

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label={t('dock.open')}
            className="fixed top-1/2 left-0 z-40 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-line-strong bg-surface text-muted shadow-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-focus lg:top-auto lg:bottom-4"
          >
            <FlaskConical size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('dock.title')}</DrawerTitle>
            <DrawerDescription className="text-body-sm text-muted">{t('dock.description')}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="flex flex-col gap-4">
            <Button
              variant="secondary"
              size="lg"
              block
              icon={<MessageCircle {...ICON} />}
              onClick={() => window.open('/sim', '_blank', 'noopener')}
            >
              {t('dock.openSim')}
            </Button>

            <div className="flex flex-col gap-1">
              <Button
                variant="secondary"
                size="lg"
                block
                loading={traffic.isPending}
                icon={<CarFront {...ICON} />}
                onClick={() => traffic.mutate()}
              >
                {t('dock.addTraffic')}
              </Button>
              <p className="text-caption text-muted">{t('dock.addTrafficHint')}</p>
            </div>

            <Separator />

            <SwitchRow
              label={t('dock.gps')}
              description={t('dock.gpsHint')}
              checked={gps.enabled}
              onCheckedChange={(on) => {
                gps.setEnabled(on)
                if (on && !gps.position) void jump('gate')
              }}
            />
            {gps.enabled ? (
              <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-3">
                <p className="text-caption text-muted">
                  {gps.position
                    ? t('dock.position', { lat: gps.position.lat.toFixed(5), lng: gps.position.lng.toFixed(5) })
                    : t('dock.noPosition')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm text-ink">{t('dock.moveTo')}</span>
                  <Button size="sm" variant="secondary" icon={<MapPin size={18} strokeWidth={1.75} />} onClick={() => void jump('gate')}>
                    {t('dock.mainGate')}
                  </Button>
                  <Button size="sm" variant="secondary" icon={<MapPin size={18} strokeWidth={1.75} />} onClick={() => void jump('mySlot')}>
                    {t('dock.mySlot')}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-ink">{t('dock.nudge')}</span>
                  <div className="ml-auto grid grid-cols-4 gap-1">
                    <Button size="icon" variant="secondary" aria-label={t('dock.north')} disabled={!gps.position} onClick={() => nudge(0)}>
                      <ArrowUp {...ICON} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="secondary" aria-label={t('dock.south')} disabled={!gps.position} onClick={() => nudge(180)}>
                      <ArrowDown {...ICON} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="secondary" aria-label={t('dock.west')} disabled={!gps.position} onClick={() => nudge(270)}>
                      <ArrowLeft {...ICON} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="secondary" aria-label={t('dock.east')} disabled={!gps.position} onClick={() => nudge(90)}>
                      <ArrowRight {...ICON} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <Separator />

            <div className="flex flex-col gap-1">
              <Button
                variant="danger-ghost"
                size="lg"
                block
                loading={reset.isPending}
                icon={<RotateCcw {...ICON} />}
                onClick={() => setConfirmReset(true)}
              >
                {t('dock.reset')}
              </Button>
              <p className="text-caption text-muted">{t('dock.resetHint')}</p>
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('dock.resetTitle')}
        description={t('dock.resetBody')}
        confirmLabel={t('dock.reset')}
        tone="danger"
        onConfirm={() => reset.mutateAsync()}
      />
    </>
  )
}
