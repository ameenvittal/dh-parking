import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useErrorText } from '@/hooks/useErrorText'
import { toast } from 'sonner'
import type { ExtractResult } from '@/types/domain'
import { extractVehicle, getPhotoUrl, uploadVehiclePhoto } from '../api'
import { useCheckinStore, type CheckinDetails } from '../store'
import { StepBody } from './StepBody'

const MAX_PHOTOS = 2

type Capture = { file: File; url: string }

function prefill(ai: ExtractResult, current: CheckinDetails): CheckinDetails {
  return {
    ...current,
    plateRaw: ai.plate ?? ai.plate_raw ?? current.plateRaw,
    vehicleType: ai.vehicle_type ?? current.vehicleType,
    color: ai.vehicle_color ?? current.color,
    make: ai.vehicle_make ?? current.make,
    category: ai.pass_detected && ai.pass_category ? ai.pass_category : current.category,
    passNumber: ai.pass_number ?? current.passNumber,
    passHolderName: ai.pass_holder_name ?? current.passHolderName,
  }
}

/** Step 1: photo, upload and AI read (docs/07 section 3.2). */
export function PhotoStep({ eventId }: { eventId: string }) {
  const { t } = useTranslation('gate')
  const errorText = useErrorText()
  const store = useCheckinStore()
  const [captures, setCaptures] = useState<Capture[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = store.aiStatus === 'uploading' || store.aiStatus === 'reading'

  // Release preview URLs.
  useEffect(() => () => captures.forEach((c) => URL.revokeObjectURL(c.url)), [captures])

  // After a refresh mid-read the files are gone; show the stored thumbnails instead.
  const storedThumb = useQuery({
    queryKey: ['photoUrl', store.photoPaths[0] ?? ''],
    queryFn: () => getPhotoUrl(store.photoPaths[0] ?? ''),
    enabled: captures.length === 0 && store.photoPaths.length > 0,
  })

  const open = () => inputRef.current?.click()

  const onFile = (file: File | undefined) => {
    if (!file) return
    store.start()
    setCaptures((prev) => [...prev, { file, url: URL.createObjectURL(file) }].slice(0, MAX_PHOTOS))
    if (inputRef.current) inputRef.current.value = ''
  }

  const retake = () => {
    setCaptures([])
    open()
  }

  const submitPhotos = async () => {
    store.start()
    store.patch({ aiStatus: 'uploading' })
    try {
      const paths: string[] = []
      for (const c of captures) paths.push((await uploadVehiclePhoto(eventId, c.file)).path)
      store.patch({ photoPaths: paths, aiStatus: 'reading' })
      const res = await extractVehicle({ eventId, photoPaths: paths })
      const current = useCheckinStore.getState().details
      if (res.result) {
        store.patch({ ai: res.result, aiStatus: 'done', details: prefill(res.result, current) })
      } else {
        store.patch({ ai: null, aiStatus: 'failed' })
      }
    } catch (err) {
      toast.error(errorText(err))
      store.patch({ ai: null, aiStatus: 'failed' })
    }
    store.setStep('details')
  }

  const manual = () => {
    store.start()
    store.patch({ aiStatus: 'skipped', ai: null })
    store.setStep('details')
  }

  const main = captures[0]?.url ?? (storedThumb.data || null)

  return (
    <StepBody
      actions={
        main ? (
          <>
            <Button size="lg" block loading={busy} onClick={() => void submitPhotos()} disabled={captures.length === 0}>
              {t('gate.photo.use')}
            </Button>
            <Button variant="secondary" size="md" block onClick={retake} disabled={busy}>
              {t('gate.photo.retake')}
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" block icon={<Camera size={20} strokeWidth={1.75} aria-hidden="true" />} onClick={open}>
              {t('gate.photo.take')}
            </Button>
            <Button variant="ghost" size="md" block onClick={manual}>
              {t('gate.photo.manual')}
            </Button>
          </>
        )
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-surface-2">
        {main ? (
          <img src={main} alt={t('gate.photo.previewAlt')} className="size-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={open}
            className="flex size-full flex-col items-center justify-center gap-3 px-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
          >
            <Camera size={32} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
            <span className="text-body text-muted">{t('gate.photo.empty')}</span>
          </button>
        )}
        {captures[1] ? (
          <div className="absolute right-3 bottom-3 h-20 w-28 overflow-hidden rounded-md border-2 border-surface shadow-overlay">
            <img src={captures[1].url} alt={t('gate.photo.passAlt')} className="size-full object-cover" />
            <button
              type="button"
              aria-label={t('gate.photo.removePass')}
              disabled={busy}
              onClick={() => setCaptures((prev) => prev.slice(0, 1))}
              className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-full bg-surface text-ink"
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {busy ? (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-surface/90 px-4 py-3" role="status" aria-live="polite">
            <Spinner size={20} />
            <span className="text-body text-ink">
              {store.aiStatus === 'uploading' ? t('gate.photo.uploading') : t('gate.photo.reading')}
            </span>
          </div>
        ) : null}
      </div>
      {captures.length === 1 && !busy ? (
        <Button
          variant="link"
          size="sm"
          className="self-start"
          icon={<ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />}
          onClick={open}
        >
          {t('gate.photo.addPass')}
        </Button>
      ) : null}
    </StepBody>
  )
}
