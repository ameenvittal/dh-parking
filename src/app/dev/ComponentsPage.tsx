import { Bike, Bus, Camera, Car, LogOut, MoreVertical, Search, Siren, Truck, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { KeyValue } from '@/components/common/KeyValue'
import { KpiStrip } from '@/components/common/KpiStrip'
import { LanguageSwitch } from '@/components/common/LanguageSwitch'
import { PlateChip } from '@/components/common/PlateChip'
import { SlotLabel } from '@/components/common/SlotLabel'
import { StatusBadge } from '@/components/common/StatusBadge'
import { VehicleCard } from '@/components/common/VehicleCard'
import { VehiclePreview } from '@/components/common/VehiclePreview'
import { IconButton } from '@/components/shell/IconButton'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/Drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { RadioGroup, RadioRow } from '@/components/ui/RadioGroup'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { SwitchRow } from '@/components/ui/SwitchRow'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Textarea'
import { AppError } from '@/lib/errors'
import { SLOT_STATUSES, VISIT_STATUSES, type VehicleType } from '@/types/domain'

/** Dev only: component gallery (T-0.4). Sample text is fixture data, not UI copy. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3">{title}</h2>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">{children}</div>
    </section>
  )
}

const ICON = { size: 20, strokeWidth: 1.75 } as const

export function ComponentsPage() {
  const [type, setType] = useState<VehicleType>('car')
  const [cat, setCat] = useState('guest')
  const [on, setOn] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [sheet, setSheet] = useState(false)

  return (
    <div className="mx-auto flex max-w-240 flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-h1">/dev/components</h1>
        <LanguageSwitch variant="short" size="sm" className="w-28 shrink-0" />
      </div>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button size="lg" icon={<Camera {...ICON} />}>Check in vehicle</Button>
          <Button variant="secondary" size="lg" icon={<LogOut {...ICON} />}>Vehicle leaving</Button>
          <Button variant="ghost">Continue without it</Button>
          <Button variant="danger" icon={<Siren {...ICON} />}>Send SOS</Button>
          <Button variant="danger-ghost">Cancel check-in</Button>
          <Button variant="link">Pick on map</Button>
          <Button loading>Assign and send</Button>
          <Button size="sm">Mark exit</Button>
          <Button size="sm" variant="secondary" disabled>Disabled</Button>
          <IconButton label="Search" icon={<Search {...ICON} />} />
          <IconButton label="SOS" tone="danger-soft" icon={<Siren {...ICON} />} />
        </div>
      </Section>

      <Section title="Plate, slot, status">
        <div className="flex flex-wrap items-center gap-3">
          <PlateChip plate="KL02AB1234" size="sm" />
          <PlateChip plate="KL02AB1234" size="md" />
          <PlateChip plate="22BH1234AA" size="lg" />
        </div>
        <div className="flex flex-wrap items-end gap-8">
          <SlotLabel label="A-012" zoneColor="zone-1" size="sm" />
          <SlotLabel label="B-004" zoneColor="zone-2" zoneName="Library parking" size="md" accessible />
          <SlotLabel label="C-021" zoneColor="zone-4" zoneName="North lawn" size="xl" ev />
        </div>
        <div className="flex flex-wrap gap-2">
          {VISIT_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
          {SLOT_STATUSES.map((s) => <StatusBadge key={`slot-${s}`} status={s} vehicleType="bike" />)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge><Badge tone="primary">Primary</Badge><Badge tone="success">Live</Badge>
          <Badge tone="warning">Away from slot</Badge><Badge tone="danger">SOS</Badge><Badge tone="outline">Closed</Badge>
        </div>
      </Section>

      <Section title="3D Vehicle previews (7 models in 4 colors)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">1. Motorcycle (Red)</span>
            <VehiclePreview vehicleType="bike" make="Royal Enfield" color="red" plate="KL01AB1234" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">2. Scooter (White)</span>
            <VehiclePreview vehicleType="bike" make="Honda Activa" color="white" plate="KL02CD5678" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">3. Hatchback Car (Blue)</span>
            <VehiclePreview vehicleType="car" make="Maruti Swift" color="blue" plate="KL03EF9012" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">4. Sedan Car (Black)</span>
            <VehiclePreview vehicleType="car" make="Honda City" color="black" plate="KL04GH3456" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">5. SUV EV (Green plate)</span>
            <VehiclePreview vehicleType="ev" make="Tata Nexon EV" color="green" plate="22BH1234AA" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-body-sm font-semibold">6. Bus (Silver)</span>
            <VehiclePreview vehicleType="bus" make="Volvo" color="silver" plate="KL06KL7890" />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-body-sm font-semibold">7. Auto-rickshaw / Other (Yellow)</span>
            <VehiclePreview vehicleType="other" make="Bajaj" color="yellow" plate="KL07MN1234" />
          </div>
        </div>
      </Section>

      <Section title="Vehicle card and KPI strip">
        <VehicleCard
          plate="KL02AB1234"
          status="driver_parked"
          vehicleType="car"
          color="white"
          make="Maruti"
          category="guest"
          slotLabel="A-012"
          time="Marked parked 1 min ago"
          badges={<Badge tone="warning">Away from slot</Badge>}
          menu={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="More" icon={<MoreVertical {...ICON} />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Not here</DropdownMenuItem>
                <DropdownMenuItem danger>Mark exit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
          actions={
            <>
              <Button variant="secondary">Wrong slot</Button>
              <Button>Confirm</Button>
            </>
          }
        />
        <KpiStrip
          items={[
            { key: 'free', label: 'Free', value: 180 },
            { key: 'way', label: 'On the way', value: 14 },
            { key: 'wait', label: 'Waiting', value: 6 },
            { key: 'parked', label: 'Parked', value: 210 },
            { key: 'left', label: 'Left', value: 96 },
            { key: 'alerts', label: 'Alerts', value: 5, tone: 'danger' },
          ]}
        />
        <KpiStrip size="compact" items={[
          { key: 'a', label: 'Free', value: 34 }, { key: 'b', label: 'Coming', value: 6 },
          { key: 'c', label: 'Waiting', value: 2 }, { key: 'd', label: 'Parked', value: 52 },
        ]} />
      </Section>

      <Section title="Form controls">
        <Field label="Number plate" htmlFor="plate" helper="Uppercase, no spaces">
          <Input id="plate" defaultValue="KL02AB1234" />
        </Field>
        <Field label="Mobile number" htmlFor="ph" error="Enter a valid 10-digit mobile number">
          <Input id="ph" invalid defaultValue="12345" />
        </Field>
        <Field label="Role" htmlFor="role">
          <Select id="role" value="gate" onChange={() => undefined} options={[{ value: 'gate', label: 'Gate volunteer' }, { value: 'zone', label: 'Zone volunteer' }]} />
        </Field>
        <Field label="Note" htmlFor="note"><Textarea id="note" placeholder="Add a note (optional)" /></Field>
        <SegmentedControl<VehicleType>
          ariaLabel="Vehicle type"
          stacked
          value={type}
          onChange={setType}
          options={[
            { value: 'bike', label: 'Bike', icon: <Bike {...ICON} /> },
            { value: 'car', label: 'Car', icon: <Car {...ICON} /> },
            { value: 'ev', label: 'EV', icon: <Zap {...ICON} /> },
            { value: 'bus', label: 'Bus', icon: <Bus {...ICON} /> },
            { value: 'other', label: 'Other', icon: <Truck {...ICON} /> },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {['vip', 'guest', 'faculty', 'student'].map((c) => (
            <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>
          ))}
        </div>
        <SwitchRow label="Needs accessible parking" checked={on} onCheckedChange={setOn} />
        <label className="flex items-center gap-3 text-body"><Checkbox defaultChecked /> Car</label>
        <RadioGroup defaultValue="medical">
          <RadioRow value="medical" label="Medical" />
          <RadioRow value="lost" label="I'm lost" />
        </RadioGroup>
        <Progress value={50} />
      </Section>

      <Section title="Feedback">
        <Alert tone="info">Pick a tool on the left to start drawing.</Alert>
        <Alert tone="success">Parking confirmed</Alert>
        <Alert tone="warning" title="Check the plate">This doesn't look like an Indian plate. Check it.</Alert>
        <ErrorState error={new AppError('SLOT_TAKEN')} onRetry={() => undefined} />
        <EmptyState title="No vehicles waiting" description="New ones appear here." action={<Button variant="secondary">Refresh</Button>} />
        <div className="flex flex-col gap-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-24" /></div>
        <dl className="rounded-md border border-line px-3">
          <KeyValue label="Slot" value="A-012" />
          <KeyValue label="Phone" value="+91 98765 43210" />
        </dl>
      </Section>

      <Section title="Overlays and tabs">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>Confirm dialog</Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>Bottom sheet</Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>Side drawer</Button>
          <Button variant="secondary" onClick={() => toast('Slot assigned')}>Toast</Button>
        </div>
        <Tabs defaultValue="waiting">
          <TabsList>
            <TabsTrigger value="waiting">Waiting (2)</TabsTrigger>
            <TabsTrigger value="coming">Coming (6)</TabsTrigger>
            <TabsTrigger value="parked">Parked (52)</TabsTrigger>
          </TabsList>
          <TabsContent value="waiting" className="py-3 text-body-sm text-muted">Waiting tab</TabsContent>
          <TabsContent value="coming" className="py-3 text-body-sm text-muted">Coming tab</TabsContent>
          <TabsContent value="parked" className="py-3 text-body-sm text-muted">Parked tab</TabsContent>
        </Tabs>
        <Table wrapperClassName="rounded-md border border-line">
          <TableHeader>
            <TableRow><TableHead>Zone</TableHead><TableHead numeric>Free</TableHead><TableHead numeric>Parked</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <TableRow><TableCell>A North lawn</TableCell><TableCell numeric>34</TableCell><TableCell numeric>22</TableCell></TableRow>
            <TableRow selected><TableCell>B Library</TableCell><TableCell numeric>12</TableCell><TableCell numeric>40</TableCell></TableRow>
          </TableBody>
        </Table>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark as parked?"
        description="Only tap this after your vehicle is in slot A-012."
        confirmLabel="Mark as parked"
        onConfirm={() => new Promise((r) => setTimeout(r, 600))}
      />
      <Drawer open={drawer} onOpenChange={setDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Need help?</DrawerTitle>
            <DrawerDescription>The event team will see your location and vehicle.</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <RadioGroup defaultValue="medical">
              <RadioRow value="medical" label="Medical" />
              <RadioRow value="breakdown" label="Vehicle breakdown" />
              <RadioRow value="safety" label="Safety" />
            </RadioGroup>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="danger" size="lg" block>Send SOS</Button>
            <Button variant="secondary" block>Call event help line</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent aria-describedby={undefined}>
          <SheetHeader><SheetTitle>KL 02 AB 1234</SheetTitle></SheetHeader>
          <SheetBody><PlateChip plate="KL02AB1234" size="lg" /></SheetBody>
          <SheetFooter><Button size="sm" variant="secondary">Resend link</Button><Button size="sm">Confirm parked</Button></SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
