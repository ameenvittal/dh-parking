import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, MapPinOff, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioRow } from '@/components/ui/RadioGroup'
import { Textarea } from '@/components/ui/Textarea'
import { DEMO_MODE } from '@/config/app'
import { useLiveLocation } from '@/features/driver/useLiveLocation'
import { useErrorText } from '@/hooks/useErrorText'
import { normalizePlate } from '@/lib/plate'
import { queryKeys } from '@/lib/queryKeys'
import { reportWrongParking, uploadAlertPhoto } from './api'
import { useZoneInvalidate } from './useZoneVisits'

const REASONS = ['blockingRoad', 'noParking', 'twoSlots', 'other'] as const
type Reason = (typeof REASONS)[number]

type ReportParkingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  /** Prefill from a vehicle card ("Report" on a parked vehicle). */
  plate?: string | null
}

/** F-ZONE-06: photo (required), optional plate, reason, note, current GPS fix (required). */
export function ReportParkingSheet({ open, onOpenChange, eventId, plate }: ReportParkingSheetProps) {
  const { t } = useTranslation(['zone', 'common'])
  const errorText = useErrorText()
  const qc = useQueryClient()
  const invalidateZone = useZoneInvalidate()
  const { status, fix } = useLiveLocation({ enabled: open })
  const effectiveFix = fix ?? (DEMO_MODE ? { lng: 75.8355, lat: 11.2585, accuracy: 15, heading: null, speed: null, at: Date.now() } : null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const pickPhoto = (f: File | null) => {
    setPhoto(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }
  const [plateText, setPlateText] = useState(plate ?? '')
  const [reason, setReason] = useState<Reason>('blockingRoad')
  const [note, setNote] = useState('')

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const reset = () => {
    pickPhoto(null)
    setReason('blockingRoad')
    setNote('')
    setPlateText('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!photo || !effectiveFix) throw new Error('missing')
      const upload = await uploadAlertPhoto(eventId, photo)
      const label = t(`zone.reportSheet.${reason}`)
      const message = note.trim() ? `${label}. ${note.trim()}` : label
      const p = normalizePlate(plateText)
      return reportWrongParking({ lng: effectiveFix.lng, lat: effectiveFix.lat, message, photoPath: upload.path, plate: p || null })
    },
    onSuccess: () => {
      toast.success(t('zone.reportSheet.sent'))
      invalidateZone(eventId)
      void qc.invalidateQueries({ queryKey: queryKeys.alerts(eventId) })
      void qc.invalidateQueries({ queryKey: queryKeys.openAlertCount(eventId) })
      reset()
      onOpenChange(false)
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const locating = !fix && !DEMO_MODE && (status === 'idle' || status === 'prompt' || status === 'watching')
  const locationOff = !fix && !DEMO_MODE && (status === 'denied' || status === 'unavailable')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('zone.reportSheet.title')}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pickPhoto(f)
              e.target.value = ''
            }}
          />
          {preview ? (
            <div className="flex items-center gap-3">
              <img src={preview} alt={t('zone.detail.photo')} className="h-24 w-32 rounded-md border border-line object-cover" />
              <Button
                variant="secondary"
                icon={<RotateCcw size={20} strokeWidth={1.75} aria-hidden="true" />}
                onClick={() => fileRef.current?.click()}
              >
                {t('zone.reportSheet.retake')}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface-2 text-body font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Camera size={28} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
              {t('zone.reportSheet.takePhoto')}
            </button>
          )}

          <Field label={t('zone.reportSheet.plate')} htmlFor="report-plate">
            <Input
              id="report-plate"
              value={plateText}
              onChange={(e) => setPlateText(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              className="font-display text-h3 tracking-wide"
            />
          </Field>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-body-sm font-semibold text-ink">{t('zone.reportSheet.reason')}</legend>
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as Reason)}>
              {REASONS.map((r) => (
                <RadioRow key={r} value={r} label={t(`zone.reportSheet.${r}`)} />
              ))}
            </RadioGroup>
          </fieldset>

          <Field label={t('zone.reportSheet.note')} htmlFor="report-note">
            <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </Field>

          {locationOff ? (
            <Alert tone="warning" icon={<MapPinOff size={20} strokeWidth={1.75} className="text-warning" aria-hidden="true" />}>
              {t('zone.reportSheet.locationOff')}
            </Alert>
          ) : locating ? (
            <p aria-live="polite" className="text-body-sm text-muted">
              {t('zone.reportSheet.locating')}
            </p>
          ) : null}
        </DrawerBody>
        <DrawerFooter>
          {!photo ? <p className="text-center text-body-sm text-muted">{t('zone.reportSheet.photoRequired')}</p> : null}
          <Button size="lg" block disabled={!photo || !effectiveFix} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && photo ? t('zone.reportSheet.uploading') : t('zone.reportSheet.send')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
