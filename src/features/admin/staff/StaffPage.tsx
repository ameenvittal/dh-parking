import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, EllipsisVertical, Plus, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { useMapData } from '@/features/map/useMapData'
import { useAuth } from '@/hooks/useAuth'
import { useErrorText } from '@/hooks/useErrorText'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { errorCode } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { formatPhone, normalizeIndianPhone } from '@/lib/phone'
import { queryKeys } from '@/lib/queryKeys'
import { useRealtime } from '@/lib/realtime'
import type { StaffRole, StaffView } from '@/types/domain'
import { ADMIN_BTN } from '../components/buttonSizes'
import { useAdminEvent } from '../layout/useAdminEvent'
import { listStaff, staffAction } from './api'

const ROLES: StaffRole[] = ['admin', 'gate_volunteer', 'zone_volunteer']
const USERNAME_RE = /^[a-z0-9_.]{3,32}$/

function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** Staff `/admin/staff` (docs/07 section 5.7, F-ADM-06). */
export function StaffPage() {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const errorText = useErrorText()
  const wide = useMediaQuery('(min-width: 768px)')
  const { session } = useAuth()
  const { eventId } = useAdminEvent()
  const { eventMap } = useMapData(eventId, { withStatuses: false })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<StaffRole | ''>('')
  const [editing, setEditing] = useState<StaffView | 'new' | null>(null)
  const [resetFor, setResetFor] = useState<StaffView | null>(null)
  const [offFor, setOffFor] = useState<StaffView | null>(null)
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null)

  const query = useQuery({ queryKey: queryKeys.staff(), queryFn: listStaff })
  const onChange = useCallback(() => void qc.invalidateQueries({ queryKey: queryKeys.staff() }), [qc])
  useRealtime(['profiles'], onChange)

  const zoneCode = useMemo(() => new Map((eventMap?.zones.features ?? []).map((z) => [String(z.id), z.properties.code])), [eventMap])
  const gateName = useMemo(() => new Map((eventMap?.gates.features ?? []).map((g) => [String(g.id), g.properties.name])), [eventMap])

  const q = search.trim().toLowerCase()
  const rows = (query.data ?? []).filter(
    (s) => (!role || s.role === role) && (!q || s.full_name.toLowerCase().includes(q) || s.username.includes(q)),
  )

  const toggle = useMutation({
    mutationFn: (s: StaffView) => staffAction({ action: s.is_active ? 'deactivate' : 'activate', id: s.id }),
    onSuccess: (_r, s) => {
      toast.success(t(s.is_active ? 'admin.staff.turnedOff' : 'admin.staff.turnedOn'))
      onChange()
    },
    onError: (err) => toast.error(errorText(err)),
  })

  const assigned = (s: StaffView) => {
    if (s.role === 'zone_volunteer') return s.zone_ids.map((id) => zoneCode.get(id) ?? '').filter(Boolean).join(', ')
    if (s.role === 'gate_volunteer')
      return s.gate_ids.length ? s.gate_ids.map((id) => gateName.get(id) ?? '').filter(Boolean).join(', ') : t('admin.staff.allGates')
    return ''
  }

  const menu = (s: StaffView) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('admin.shared.rowActions')}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:size-9"
        >
          <EllipsisVertical size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setEditing(s)}>{t('admin.staff.actions.edit')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setResetFor(s)}>{t('admin.staff.actions.resetPassword')}</DropdownMenuItem>
        {s.is_active ? (
          <DropdownMenuItem danger disabled={s.id === session?.userId} onSelect={() => setOffFor(s)}>
            {t('admin.staff.actions.turnOff')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => toggle.mutate(s)}>{t('admin.staff.actions.turnOn')}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const statusBadge = (s: StaffView) => <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? t('admin.staff.active') : t('admin.staff.off')}</Badge>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.staff.search')} aria-label={t('admin.staff.search')} className="pl-9" />
        </div>
        <Select
          aria-label={t('admin.staff.roleFilter')}
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole | '')}
          className="sm:w-48"
          options={[{ value: '', label: t('admin.staff.allRoles') }, ...ROLES.map((r) => ({ value: r, label: t(`admin.role.${r}`) }))]}
        />
        <Button size="md" className={ADMIN_BTN} icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />} onClick={() => setEditing('new')}>
          {t('admin.staff.add')}
        </Button>
      </div>

      {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
      {query.isLoading ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState title={t('admin.staff.empty')} />
        </div>
      ) : wide ? (
        <div className="overflow-hidden rounded-lg border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                {(['name', 'username', 'role', 'assigned', 'phone', 'status', 'lastSeen'] as const).map((c) => (
                  <TableHead key={c}>{t(`admin.staff.columns.${c}`)}</TableHead>
                ))}
                <TableHead>
                  <span className="sr-only">{t('admin.shared.rowActions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold">{s.full_name}</TableCell>
                  <TableCell className="text-muted">{s.username}</TableCell>
                  <TableCell>
                    <Badge tone={s.role === 'admin' ? 'primary' : 'neutral'}>{t(`admin.role.${s.role}`)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted">{assigned(s)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{s.phone ? formatPhone(s.phone) : ''}</TableCell>
                  <TableCell>{statusBadge(s)}</TableCell>
                  <TableCell className="text-muted">{s.last_seen_at ? formatDateTime(s.last_seen_at) : t('admin.staff.never')}</TableCell>
                  <TableCell className="w-12 text-right">{menu(s)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-3 pr-2 pl-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{s.full_name}</span>
                  {statusBadge(s)}
                </span>
                <span className="text-body-sm text-muted">{s.username}</span>
                <span className="flex flex-wrap gap-x-3 text-body-sm text-muted">
                  <span>{t(`admin.role.${s.role}`)}</span>
                  {assigned(s) ? <span>{assigned(s)}</span> : null}
                </span>
              </div>
              {menu(s)}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <StaffDialog
          staff={editing === 'new' ? null : editing}
          zones={(eventMap?.zones.features ?? []).map((z) => ({ id: String(z.id), label: z.properties.code }))}
          gates={(eventMap?.gates.features ?? []).map((g) => ({ id: String(g.id), label: g.properties.name }))}
          onClose={() => setEditing(null)}
          onCreated={(c) => {
            setEditing(null)
            setCreds(c)
          }}
        />
      ) : null}

      <ResetPasswordDialog staff={resetFor} onClose={() => setResetFor(null)} onDone={(c) => setCreds(c)} />

      <ConfirmDialog
        open={Boolean(offFor)}
        onOpenChange={(o) => !o && setOffFor(null)}
        tone="danger"
        title={t('admin.staff.turnOffDialog.title', { name: offFor?.full_name ?? '' })}
        description={t('admin.staff.turnOffDialog.body')}
        confirmLabel={t('admin.staff.turnOffDialog.submit')}
        onConfirm={async () => {
          if (offFor) await toggle.mutateAsync(offFor)
        }}
      />

      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
    </div>
  )
}

type Option = { id: string; label: string }

function StaffDialog({
  staff,
  zones,
  gates,
  onClose,
  onCreated,
}: {
  staff: StaffView | null
  zones: Option[]
  gates: Option[]
  onClose: () => void
  onCreated: (c: { username: string; password: string }) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const qc = useQueryClient()
  const errorText = useErrorText()
  const isNew = !staff
  const [fullName, setFullName] = useState(staff?.full_name ?? '')
  const [username, setUsername] = useState(staff?.username ?? '')
  const [role, setRole] = useState<StaffRole>(staff?.role ?? 'gate_volunteer')
  const [phone, setPhone] = useState(staff?.phone ? staff.phone.slice(-10) : '')
  const [zoneIds, setZoneIds] = useState<string[]>(staff?.zone_ids ?? [])
  const [gateIds, setGateIds] = useState<string[]>(staff?.gate_ids ?? [])
  const [password, setPassword] = useState('')
  const [tried, setTried] = useState(false)
  const [usernameTaken, setUsernameTaken] = useState(false)

  const errors = {
    fullName: fullName.trim() ? null : t('admin.staff.dialog.nameRequired'),
    username: isNew && !USERNAME_RE.test(username) ? t('admin.staff.dialog.usernameInvalid') : usernameTaken ? t('errors.USERNAME_TAKEN') : null,
    phone: phone && !normalizeIndianPhone(phone) ? t('admin.staff.dialog.phoneInvalid') : null,
    zones: role === 'zone_volunteer' && zoneIds.length === 0 ? t('admin.staff.dialog.zonesRequired') : null,
    password: isNew && password.length < 8 ? t('admin.staff.dialog.passwordInvalid') : null,
  }
  const valid = Object.values(errors).every((e) => !e)

  const mutation = useMutation({
    mutationFn: () => {
      const e164 = phone ? normalizeIndianPhone(phone) : null
      const zs = role === 'zone_volunteer' ? zoneIds : []
      const gs = role === 'gate_volunteer' ? gateIds : []
      return isNew
        ? staffAction({ action: 'create', username, full_name: fullName.trim(), role, phone: e164, zone_ids: zs, gate_ids: gs, password })
        : staffAction({
            action: 'update',
            id: staff.id,
            full_name: fullName.trim(),
            role,
            phone: e164,
            zone_ids: zs,
            gate_ids: gs,
            preferred_language: staff.preferred_language,
          })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.staff() })
      if (isNew) {
        toast.success(t('admin.staff.createdToast'))
        onCreated({ username, password })
      } else {
        toast.success(t('admin.staff.savedToast'))
        onClose()
      }
    },
    onError: (err) => {
      if (errorCode(err) === 'USERNAME_TAKEN') setUsernameTaken(true)
      else toast.error(errorText(err))
    },
  })

  const show = (e: string | null) => (tried ? e : null)
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? t('admin.staff.dialog.addTitle') : t('admin.staff.dialog.editTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setTried(true)
            if (valid) mutation.mutate()
          }}
        >
          <Field label={t('admin.staff.dialog.fullName')} htmlFor="st-name" error={show(errors.fullName)}>
            <Input id="st-name" value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={Boolean(show(errors.fullName))} />
          </Field>
          {isNew ? (
            <Field label={t('admin.staff.dialog.username')} htmlFor="st-user" helper={t('admin.staff.dialog.usernameHelper')} error={show(errors.username) ?? (usernameTaken ? errors.username : null)}>
              <Input
                id="st-user"
                value={username}
                autoCapitalize="none"
                autoComplete="off"
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase())
                  setUsernameTaken(false)
                }}
                invalid={Boolean(show(errors.username))}
              />
            </Field>
          ) : null}
          <Field label={t('admin.staff.dialog.role')} htmlFor="st-role">
            <Select id="st-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} options={ROLES.map((r) => ({ value: r, label: t(`admin.role.${r}`) }))} />
          </Field>
          <Field label={t('admin.staff.dialog.phone')} htmlFor="st-phone" error={show(errors.phone)}>
            <Input id="st-phone" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} invalid={Boolean(show(errors.phone))} />
          </Field>
          {role === 'zone_volunteer' ? (
            <Field label={t('admin.staff.dialog.zones')} error={show(errors.zones)}>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => (
                  <Chip key={z.id} selected={zoneIds.includes(z.id)} onClick={() => setZoneIds((l) => toggleIn(l, z.id))}>
                    {z.label}
                  </Chip>
                ))}
              </div>
            </Field>
          ) : null}
          {role === 'gate_volunteer' ? (
            <Field label={t('admin.staff.dialog.gates')} helper={t('admin.staff.dialog.gatesHelper')}>
              <div className="flex flex-wrap gap-2">
                {gates.map((g) => (
                  <Chip key={g.id} selected={gateIds.includes(g.id)} onClick={() => setGateIds((l) => toggleIn(l, g.id))}>
                    {g.label}
                  </Chip>
                ))}
              </div>
            </Field>
          ) : null}
          {isNew ? (
            <Field label={t('admin.staff.dialog.password')} htmlFor="st-pass" helper={t('admin.staff.dialog.passwordHelper')} error={show(errors.password)}>
              <div className="flex gap-2">
                <Input id="st-pass" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} invalid={Boolean(show(errors.password))} className="font-mono" />
                <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => setPassword(generatePassword())}>
                  {t('admin.staff.dialog.generate')}
                </Button>
              </div>
            </Field>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={onClose}>
              {t('admin.shared.cancel')}
            </Button>
            <Button type="submit" size="md" className={ADMIN_BTN} loading={mutation.isPending}>
              {isNew ? t('admin.staff.dialog.create') : t('admin.staff.dialog.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({
  staff,
  onClose,
  onDone,
}: {
  staff: StaffView | null
  onClose: () => void
  onDone: (c: { username: string; password: string }) => void
}) {
  const { t } = useTranslation(['admin', 'common'])
  const errorText = useErrorText()
  const [password, setPassword] = useState('')
  return (
    <ConfirmDialog
      open={Boolean(staff)}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setPassword('')
        }
      }}
      title={t('admin.staff.reset.title', { name: staff?.full_name ?? '' })}
      description={t('admin.staff.reset.body')}
      confirmLabel={t('admin.staff.reset.submit')}
      confirmDisabled={password.length < 8}
      onConfirm={async () => {
        if (!staff) return
        try {
          await staffAction({ action: 'reset_password', id: staff.id, password })
          onDone({ username: staff.username, password })
          setPassword('')
        } catch (err) {
          toast.error(errorText(err))
          throw err
        }
      }}
    >
      <Field label={t('admin.staff.dialog.password')} htmlFor="reset-pass" helper={t('admin.staff.dialog.passwordHelper')}>
        <div className="flex gap-2">
          <Input id="reset-pass" value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" autoComplete="new-password" />
          <Button variant="secondary" size="md" className={ADMIN_BTN} onClick={() => setPassword(generatePassword())}>
            {t('admin.staff.dialog.generate')}
          </Button>
        </div>
      </Field>
    </ConfirmDialog>
  )
}

function CredentialsDialog({ creds, onClose }: { creds: { username: string; password: string } | null; onClose: () => void }) {
  const { t } = useTranslation('admin')
  return (
    <Dialog open={Boolean(creds)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.staff.credentials.title')}</DialogTitle>
          <DialogDescription>{t('admin.staff.credentials.body')}</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-3 rounded-md bg-surface-2 p-4">
          <div className="flex justify-between gap-3">
            <dt className="text-body-sm text-muted">{t('admin.staff.credentials.username')}</dt>
            <dd className="font-mono text-body text-ink">{creds?.username}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-body-sm text-muted">{t('admin.staff.credentials.password')}</dt>
            <dd className="font-mono text-body text-ink">{creds?.password}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button
            variant="secondary"
            size="md"
            className={ADMIN_BTN}
            icon={<Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => {
              if (!creds) return
              void navigator.clipboard
                ?.writeText(`${t('admin.staff.credentials.username')}: ${creds.username}\n${t('admin.staff.credentials.password')}: ${creds.password}`)
                .then(() => toast.success(t('admin.staff.credentials.copied')))
            }}
          >
            {t('admin.staff.credentials.copy')}
          </Button>
          <Button size="md" className={ADMIN_BTN} onClick={onClose}>
            {t('admin.staff.credentials.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
