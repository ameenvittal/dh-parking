import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { useErrorText } from '@/hooks/useErrorText'
import type { EventListItem, TestMessageResult } from '@/lib/demo/types'
import { formatPhone, normalizeIndianPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { VEHICLE_TYPES, VISITOR_CATEGORIES, type BaseMapKind, type EventRow, type Language, type WaTemplate } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { RequireEvent } from '../components/RequireEvent'
import { getEventSettings, sendTestMessage, updateEventSettings, type EventInput } from './api'

const SECTIONS = ['event', 'timings', 'location', 'emergency', 'map', 'whatsapp', 'language'] as const
const TEMPLATES: WaTemplate[] = ['parking_slot_assigned', 'parking_login_link', 'parking_slot_changed', 'sos_admin_alert']

/** Settings `/admin/settings` (docs/07 section 5.11, F-ADM-07). */
export function SettingsPage() {
  return <RequireEvent>{(event) => <SettingsView event={event} />}</RequireEvent>
}

function SettingsView({ event: listed }: { event: EventListItem }) {
  const { t } = useTranslation(['admin', 'common'])
  const query = useQuery({ queryKey: queryKeys.eventSettings(listed.id), queryFn: () => getEventSettings(listed.id) })
  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-lg" />
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const e = query.data
  return (
    <div className="flex gap-8">
      <nav aria-label={t('admin.settings.sectionsNav')} className="sticky top-4 hidden w-48 shrink-0 self-start xl:block">
        <ul className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <li key={s}>
              <a href={`#settings-${s}`} className="flex h-10 items-center rounded-md px-3 text-body-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                {t(`admin.settings.sections.${s}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex max-w-3xl min-w-0 flex-1 flex-col gap-6">
        <EventSection e={e} />
        <TimingsSection e={e} />
        <LocationSection e={e} />
        <EmergencySection e={e} />
        <MapSection e={e} />
        <WhatsAppSection />
        <LanguageSection e={e} />
      </div>
    </div>
  )
}

/** One card with its own Save: secondary until dirty, then primary. */
function useSection<T>(eventId: string, initial: T, toPatch: (v: T) => Omit<EventInput, 'id'>) {
  const { t } = useTranslation('admin')
  const qc = useQueryClient()
  const errorText = useErrorText()
  const [value, setValue] = useState<T>(initial)
  const initialKey = JSON.stringify(initial)
  useEffect(() => {
    setValue(JSON.parse(initialKey) as T)
  }, [initialKey])
  const dirty = JSON.stringify(value) !== initialKey
  const save = useMutation({
    mutationFn: () => updateEventSettings(eventId, toPatch(value)),
    onSuccess: () => {
      toast.success(t('admin.settings.saved'))
      void qc.invalidateQueries({ queryKey: queryKeys.eventSettings(eventId) })
      void qc.invalidateQueries({ queryKey: queryKeys.events() })
      void qc.invalidateQueries({ queryKey: queryKeys.eventMap(eventId) })
    },
    onError: (err) => toast.error(errorText(err)),
  })
  return { value, setValue, dirty, save }
}

function Section({
  id,
  dirty,
  saving,
  onSave,
  canSave = true,
  children,
}: {
  id: (typeof SECTIONS)[number]
  dirty?: boolean
  saving?: boolean
  onSave?: () => void
  canSave?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation('admin')
  return (
    <section id={`settings-${id}`} className="scroll-mt-4 rounded-lg border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-h3 text-ink lg:px-6">{t(`admin.settings.sections.${id}`)}</h2>
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">{children}</div>
      {onSave ? (
        <div className="flex justify-end border-t border-line px-4 py-3 lg:px-6">
          <Button variant={dirty ? 'primary' : 'secondary'} size="md" className={ADMIN_BTN} disabled={!dirty || !canSave} loading={saving} onClick={onSave}>
            {t('admin.settings.save')}
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function num(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN
}

function EventSection({ e }: { e: EventRow }) {
  const { t } = useTranslation(['admin', 'common'])
  const s = useSection(
    e.id,
    { paid: e.paid_parking, fees: Object.fromEntries(VEHICLE_TYPES.map((ty) => [ty, String(e.fee_rules[ty] ?? 0)])), free: e.fee_exempt_categories },
    (v) => ({
      paid_parking: v.paid,
      fee_rules: Object.fromEntries(VEHICLE_TYPES.map((ty) => [ty, num(v.fees[ty] ?? '0') || 0])) as EventRow['fee_rules'],
      fee_exempt_categories: v.free,
    }),
  )
  const invalid = VEHICLE_TYPES.some((ty) => Number.isNaN(num(s.value.fees[ty] ?? '')))
  return (
    <Section id="event" dirty={s.dirty} saving={s.save.isPending} canSave={!invalid} onSave={() => s.save.mutate()}>
      <SwitchRow label={t('admin.settings.paidParking')} description={t('admin.settings.paidParkingHelp')} checked={s.value.paid} onCheckedChange={(paid) => s.setValue({ ...s.value, paid })} />
      <Field label={t('admin.settings.feePerType')} error={invalid ? t('admin.settings.numberInvalid') : null}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {VEHICLE_TYPES.map((ty) => (
            <label key={ty} className="flex flex-col gap-1 text-body-sm text-muted">
              {t(`common.enums.vehicleType.${ty}`)}
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={s.value.fees[ty] ?? ''}
                disabled={!s.value.paid}
                onChange={(ev) => s.setValue({ ...s.value, fees: { ...s.value.fees, [ty]: ev.target.value } })}
              />
            </label>
          ))}
        </div>
      </Field>
      <Field label={t('admin.settings.freeCategories')}>
        <div className="flex flex-wrap gap-2">
          {VISITOR_CATEGORIES.map((c) => {
            const on = s.value.free.includes(c)
            return (
              <Chip key={c} selected={on} onClick={() => s.setValue({ ...s.value, free: on ? s.value.free.filter((x) => x !== c) : [...s.value.free, c] })}>
                {t(`common.enums.category.${c}`)}
              </Chip>
            )
          })}
        </div>
      </Field>
    </Section>
  )
}

function NumberField({ id, label, helper, value, onChange }: { id: string; label: string; helper?: string; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('admin')
  const bad = Number.isNaN(num(value))
  return (
    <Field label={label} htmlFor={id} helper={helper} error={bad ? t('admin.settings.numberInvalid') : null}>
      <Input id={id} type="number" min={0} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} invalid={bad} className="sm:max-w-40" />
    </Field>
  )
}

function TimingsSection({ e }: { e: EventRow }) {
  const { t } = useTranslation('admin')
  const s = useSection(
    e.id,
    { arrival: String(e.arrival_timeout_min), confirm: String(e.confirm_timeout_min), overstay: String(e.overstay_after_end_min) },
    (v) => ({ arrival_timeout_min: num(v.arrival), confirm_timeout_min: num(v.confirm), overstay_after_end_min: num(v.overstay) }),
  )
  const ok = [s.value.arrival, s.value.confirm, s.value.overstay].every((x) => !Number.isNaN(num(x)))
  return (
    <Section id="timings" dirty={s.dirty} saving={s.save.isPending} canSave={ok} onSave={() => s.save.mutate()}>
      <NumberField id="st-arr" label={t('admin.settings.arrivalTimeout')} helper={t('admin.settings.arrivalTimeoutHelp')} value={s.value.arrival} onChange={(arrival) => s.setValue({ ...s.value, arrival })} />
      <NumberField id="st-conf" label={t('admin.settings.confirmTimeout')} helper={t('admin.settings.confirmTimeoutHelp')} value={s.value.confirm} onChange={(confirm) => s.setValue({ ...s.value, confirm })} />
      <NumberField id="st-over" label={t('admin.settings.overstay')} value={s.value.overstay} onChange={(overstay) => s.setValue({ ...s.value, overstay })} />
    </Section>
  )
}

function LocationSection({ e }: { e: EventRow }) {
  const { t } = useTranslation('admin')
  const s = useSection(e.id, { radius: String(e.arrival_radius_m), tol: String(e.location_tolerance_m) }, (v) => ({
    arrival_radius_m: num(v.radius),
    location_tolerance_m: num(v.tol),
  }))
  const ok = !Number.isNaN(num(s.value.radius)) && !Number.isNaN(num(s.value.tol))
  return (
    <Section id="location" dirty={s.dirty} saving={s.save.isPending} canSave={ok} onSave={() => s.save.mutate()}>
      <NumberField id="st-rad" label={t('admin.settings.arrivalRadius')} helper={t('admin.settings.arrivalRadiusHelp')} value={s.value.radius} onChange={(radius) => s.setValue({ ...s.value, radius })} />
      <NumberField id="st-tol" label={t('admin.settings.tolerance')} helper={t('admin.settings.toleranceHelp')} value={s.value.tol} onChange={(tol) => s.setValue({ ...s.value, tol })} />
    </Section>
  )
}

function EmergencySection({ e }: { e: EventRow }) {
  const { t } = useTranslation('admin')
  const s = useSection(e.id, { help: e.emergency_phone ? e.emergency_phone.slice(-10) : '', phones: e.admin_alert_phones }, (v) => ({
    emergency_phone: v.help ? normalizeIndianPhone(v.help) : null,
    admin_alert_phones: v.phones,
  }))
  const [draft, setDraft] = useState('')
  const helpBad = Boolean(s.value.help) && !normalizeIndianPhone(s.value.help)
  const draftE164 = normalizeIndianPhone(draft)
  return (
    <Section id="emergency" dirty={s.dirty} saving={s.save.isPending} canSave={!helpBad} onSave={() => s.save.mutate()}>
      <Field label={t('admin.settings.helpLine')} htmlFor="st-help" error={helpBad ? t('admin.settings.phoneInvalid') : null}>
        <Input
          id="st-help"
          inputMode="tel"
          value={s.value.help}
          placeholder={t('admin.settings.phonePlaceholder')}
          onChange={(ev) => s.setValue({ ...s.value, help: ev.target.value.replace(/\D/g, '').slice(0, 10) })}
          invalid={helpBad}
          className="sm:max-w-60"
        />
      </Field>
      <Field label={t('admin.settings.adminPhones')} error={draft && !draftE164 ? t('admin.settings.phoneInvalid') : null}>
        {s.value.phones.length === 0 ? <p className="text-body-sm text-muted">{t('admin.settings.noAdminPhones')}</p> : null}
        <ul className="flex flex-wrap gap-2">
          {s.value.phones.map((p) => (
            <li key={p}>
              <Badge tone="outline" className="h-9 gap-2 pr-1 text-body-sm">
                <span className="tabular-nums">{formatPhone(p)}</span>
                <button
                  type="button"
                  aria-label={t('admin.settings.removePhone', { phone: formatPhone(p) })}
                  onClick={() => s.setValue({ ...s.value, phones: s.value.phones.filter((x) => x !== p) })}
                  className="inline-flex size-7 items-center justify-center rounded-xs text-muted hover:bg-surface-2"
                >
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 sm:max-w-96">
          <Input
            inputMode="tel"
            aria-label={t('admin.settings.addPhone')}
            value={draft}
            placeholder={t('admin.settings.phonePlaceholder')}
            onChange={(ev) => setDraft(ev.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <Button
            variant="secondary"
            size="md"
            className={ADMIN_BTN}
            icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
            disabled={!draftE164}
            onClick={() => {
              if (!draftE164) return
              if (!s.value.phones.includes(draftE164)) s.setValue({ ...s.value, phones: [...s.value.phones, draftE164] })
              setDraft('')
            }}
          >
            {t('admin.settings.addPhone')}
          </Button>
        </div>
      </Field>
    </Section>
  )
}

function MapSection({ e }: { e: EventRow }) {
  const { t } = useTranslation('admin')
  const s = useSection<BaseMapKind>(e.id, e.base_map, (v) => ({ base_map: v }))
  return (
    <Section id="map" dirty={s.dirty} saving={s.save.isPending} onSave={() => s.save.mutate()}>
      <Field label={t('admin.settings.baseMap')}>
        <SegmentedControl<BaseMapKind>
          ariaLabel={t('admin.settings.baseMap')}
          value={s.value}
          onChange={s.setValue}
          className="sm:max-w-80"
          options={[
            { value: 'street', label: t('admin.settings.street') },
            { value: 'satellite', label: t('admin.settings.satellite') },
          ]}
        />
      </Field>
    </Section>
  )
}

function WhatsAppSection() {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const [phone, setPhone] = useState('')
  const [template, setTemplate] = useState<WaTemplate>('parking_slot_assigned')
  const [result, setResult] = useState<TestMessageResult | null>(null)
  const e164 = normalizeIndianPhone(phone)
  const send = useMutation({
    mutationFn: () => sendTestMessage({ phone: e164 ?? '', template, language: 'en' }),
    onSuccess: setResult,
    onError: (err) => toast.error(errorText(err)),
  })
  return (
    <Section id="whatsapp">
      <h3 className="text-body-sm font-semibold text-ink">{t('admin.settings.testTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('admin.settings.testPhone')} htmlFor="wa-phone" error={phone && !e164 ? t('admin.settings.phoneInvalid') : null}>
          <Input id="wa-phone" inputMode="tel" value={phone} placeholder={t('admin.settings.phonePlaceholder')} onChange={(ev) => setPhone(ev.target.value.replace(/\D/g, '').slice(0, 10))} />
        </Field>
        <Field label={t('admin.settings.testTemplate')} htmlFor="wa-tpl">
          <Select id="wa-tpl" value={template} onChange={(ev) => setTemplate(ev.target.value as WaTemplate)} options={TEMPLATES.map((tp) => ({ value: tp, label: t(`admin.waTemplate.${tp}`) }))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" className={ADMIN_BTN} disabled={!e164} loading={send.isPending} onClick={() => send.mutate()}>
          {t('admin.settings.testSend')}
        </Button>
        {result ? (
          <p aria-live="polite" className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
            <Badge tone={result.status === 'failed' ? 'danger' : 'success'}>{t('admin.settings.testResult', { status: t(`admin.waStatus.${result.status}`) })}</Badge>
            {result.error ? <span className="text-danger">{result.error}</span> : null}
            <Link to="/sim" className="font-semibold text-primary underline-offset-4 hover:underline">
              {t('admin.settings.testOpenSim')}
            </Link>
          </p>
        ) : null}
      </div>
    </Section>
  )
}

function LanguageSection({ e }: { e: EventRow }) {
  const { t } = useTranslation(['admin', 'common'])
  const s = useSection<Language>(e.id, e.default_language, (v) => ({ default_language: v }))
  return (
    <Section id="language" dirty={s.dirty} saving={s.save.isPending} onSave={() => s.save.mutate()}>
      <Field label={t('admin.settings.messageLanguage')}>
        <SegmentedControl<Language>
          ariaLabel={t('admin.settings.messageLanguage')}
          value={s.value}
          onChange={s.setValue}
          className="sm:max-w-80"
          options={[
            { value: 'en', label: t('common.languages.en') },
            { value: 'ml', label: t('common.languages.ml') },
          ]}
        />
      </Field>
    </Section>
  )
}
