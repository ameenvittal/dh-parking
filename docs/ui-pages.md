# 07. UI Pages

Every screen in the app. For each: route, who sees it, layout with placement, data, actions, and states. Text in quotes is the English copy; the i18n key is in brackets where it matters. Components refer to `06-DESIGN-SYSTEM.md`.

## 0. Route map

| Route | Page | Role |
|---|---|---|
| `/` | Redirect by role | any |
| `/login` | Staff login | public |
| `/d/:token` | Driver link exchange | public |
| `/driver/login` | Driver phone login (link resend) | public |
| `/driver` | Driver home (Your parking) | driver |
| `/driver/navigate` | Live navigation to slot | driver |
| `/driver/find` | Find my vehicle | driver |
| `/gate` | Gate home | gate, admin |
| `/gate/checkin` | Check-in wizard | gate, admin |
| `/gate/exit` | Exit | gate, admin |
| `/gate/vehicles` | Vehicle search and actions | gate, admin |
| `/zone` | Zone vehicles | zone, admin |
| `/zone/visit/:id` | Zone vehicle detail | zone, admin |
| `/admin` | Dashboard | admin |
| `/admin/live` | Live map | admin |
| `/admin/vehicles` | Vehicles | admin |
| `/admin/alerts` | Alerts | admin |
| `/admin/map-editor` | Map editor | admin |
| `/admin/zones` | Zones and slots | admin |
| `/admin/staff` | Staff | admin |
| `/admin/reports` | Reports | admin |
| `/admin/assistant` | Assistant | admin |
| `/admin/events` | Events | admin |
| `/admin/settings` | Settings | admin |

Global rules for all pages:
- Loading: skeleton blocks shaped like the final layout, no spinners over whole pages.
- Errors from queries: inline `Alert` with the mapped error text and a "Try again" button.
- Offline banner (design system section 6) on every staff and driver page.
- All staff pages show the live event name in the top bar. If no event is live, gate and zone pages show an empty state "No event is live right now" and nothing else.

---

## 1. Auth

### 1.1 Staff login `/login`

```
┌──────────────────────────────┐
│                              │
│  EventPark          (logo)   │  text-h2, left aligned
│  Staff sign in               │  text-body text-muted
│                              │
│  Username  [____________]    │
│  Password  [________] (eye)  │
│                              │
│  [        Sign in        ]   │  primary lg, full width
│                              │
│  Language  [ English | മലയാളം ] │ segmented, bottom
└──────────────────────────────┘
```

- Centered column, max-width 400 px, on `bg-canvas`, form inside `bg-surface rounded-lg border p-6` on desktop; no card on mobile.
- Username field lowercases input, `autocapitalize="none"`.
- Errors: wrong credentials "Username or password is wrong". Inactive (`app_role = none`) "Your account is turned off. Contact the admin."
- On success redirect by role.

### 1.2 Driver link exchange `/d/:token`

- Full-screen centered: spinner (24 px) and "Opening your parking…".
- Calls `driver-login`, then `verifyOtp`, then navigates to `/driver` (or `/driver/consent` state inside home if consent not given).
- On `TOKEN_INVALID`: redirect to `/driver/login?expired=1`.

### 1.3 Driver phone login `/driver/login`

```
┌──────────────────────────────┐
│ Top bar: EventPark   [EN|ML] │
├──────────────────────────────┤
│ Get your parking link        │ text-h2
│ Enter the mobile number you  │ text-body text-muted
│ gave at the gate. We'll send │
│ the link on WhatsApp.        │
│                              │
│ (Alert if ?expired=1:        │
│  "That link has expired.     │
│   Get a new one below.")     │
│                              │
│ Mobile number                │
│ [+91 | __________ ]          │ numeric keypad, 10 digits
│                              │
├──────────────────────────────┤
│ [   Send link on WhatsApp  ] │ primary lg, sticky bottom
└──────────────────────────────┘
```

- After submit (always same): replace form with "If this number has parking today, a link is on its way on WhatsApp." and a secondary button "Send again" enabled after 60 s countdown ("Send again in 42 s").
- `RATE_LIMITED` → "Too many tries. Wait a few minutes."

---

## 2. Driver

Driver screens are mobile only. Language switch lives in the top bar menu. Top bar right side always has the SOS button (see 2.5).

### 2.1 Location consent (state inside `/driver`, shown when `drivers.location_consent_at` is null)

```
┌──────────────────────────────┐
│ Your parking          [SOS]  │
├──────────────────────────────┤
│ [SlotLabel xl  A-012]        │
│ North lawn                   │
│                              │
│ Allow location to get        │ text-h3
│ directions to your slot      │
│                              │
│ Your location is shared with │ text-body text-muted
│ the event team only while    │
│ you drive to your slot. It   │
│ stops once your parking is   │
│ confirmed.                   │
├──────────────────────────────┤
│ [     Allow location      ]  │ primary lg
│ [   Continue without it   ]  │ ghost md
└──────────────────────────────┘
```

- "Allow location" calls `driver_accept_location_consent` then triggers the browser prompt through `useLiveLocation`.
- If the browser denies: show inline `Alert` warning "Location is off. You can still see your slot on the map." with a link "How to turn it on" that opens a sheet with short steps for Chrome and Safari.
- "Continue without it" goes to home without navigation features (map still shows the slot).

### 2.2 Driver home `/driver` — "Your parking"

Layout: map on top 55% of the viewport, bottom sheet at "half" snap with details.

```
┌──────────────────────────────┐
│ (map, full-bleed)      [SOS] │  top bar transparent over map: menu left, SOS right
│                              │
│   zones, highlighted slot,   │
│   gate, user puck            │
│                   [controls] │
├──────────────────────────────┤  bottom sheet (half)
│ ─── (grabber)                │
│ [SlotLabel xl A-012]  [Badge]│  status badge right
│ North lawn                   │
│ [PlateChip md KL 02 AB 1234] │
│ 350 m from you               │  only when location on
│ Near Main auditorium         │  nearest landmark
│                              │
│ [    Start directions     ]  │  primary lg
│ [    Mark as parked       ]  │  secondary md
└──────────────────────────────┘
```

Data: `driver_get_my_visit`, `get_event_map` (driver sees all zones but only own slot highlighted; other slots drawn in neutral `status-occupied-soft` without status colours), realtime on own visit.

Button logic by visit status:

| Status | Primary | Secondary | Extra |
|---|---|---|---|
| assigned, en_route | "Start directions" → `/driver/navigate` (calls `driver_start_navigation`) | "Mark as parked" (confirm dialog) | |
| driver_parked | "Find my vehicle" → `/driver/find` | none | Info row: "Waiting for the volunteer to check your parking" with `Hourglass` |
| confirmed | "Find my vehicle" | none | Info row success: "Parking confirmed" |
| exited | none | none | Replace sheet with "Thanks for visiting. Your visit has ended." |
| cancelled | none | none | "This parking was cancelled. Ask a volunteer at the gate." |

Mark as parked dialog: title "Mark as parked?", body "Only tap this after your vehicle is in slot A-012.", buttons "Cancel" / "Mark as parked". On success toast "Marked as parked". If response `mismatch = true`: warning `Alert` in sheet "You seem to be away from slot A-012. A volunteer will check." (no blocking).

Reassignment (realtime slot change): full-width `Alert` at top of sheet "Your slot changed to B-004" with the new label, map re-fits, route cleared. Toast too.

Menu (top-left, sheet): Language (EN / ML segmented), "Location sharing" switch (only while active), "Event help line" (tel link, shown if `emergency_phone`), "Log out".

### 2.3 Navigate `/driver/navigate`

```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │  instruction card, floating top, bg-primary text-on-primary
│ │ (arrow icon 32)          │ │
│ │ Turn left in 40 m        │ │  text-h2
│ │ then continue 120 m      │ │  text-body (next step)
│ └──────────────────────────┘ │
│                              │
│   map in follow mode         │
│   route line + puck          │
│                  [recenter]  │
│                  [layers]    │
├──────────────────────────────┤
│ A-012   North lawn     [SOS] │  bottom bar 72px: SlotLabel sm, zone, SOS icon button
│ 180 m   about 1 min   [End]  │  remaining distance, ETA (10 km/h), "End" ghost
└──────────────────────────────┘
```

- Arrow icons map: straight `ArrowUp`, slight left `ArrowUpLeft`, left `CornerUpLeft`, sharp left `CornerUpLeft` rotated, uturn `Undo2`, arrive `MapPin`. Right versions mirrored (`ArrowUpRight`, `CornerUpRight`).
- States:
  - Waiting for GPS: instruction card shows "Finding your location…".
  - Location denied: redirect back to `/driver` with the location off alert.
  - Off campus (no snap within 150 m): card "Head to the campus gate" and map fits gate + slot.
  - No route: card "Follow the volunteers' directions to Zone A"; dashed straight line.
  - Rerouting: card text "Finding a new route…" for up to 1 s.
- Arrival (within `arrival_radius_m`): bottom sheet slides up: "You have arrived", SlotLabel md, "Park in A-012, then tap below.", primary "Mark as parked", ghost "Not yet". After marking: navigate to `/driver`.
- "End" returns to `/driver` (keeps sharing location while status is active).
- Wake lock active on this page.

### 2.4 Find my vehicle `/driver/find`

```
┌──────────────────────────────┐
│ ← Find my vehicle     [SOS]  │
├──────────────────────────────┤
│ map: walking route to slot   │
│ (60% height)                 │
├──────────────────────────────┤
│ [SlotLabel xl A-012]         │
│ North lawn                   │
│ Near Main auditorium         │
│ 240 m walk, about 3 min      │
│ [PlateChip md]               │
│ [   Walk me there          ] │  primary: starts walking follow mode on the same map
└──────────────────────────────┘
```

Walking mode uses the walk graph, 1.2 m/s ETA, no one-way rules, same instruction card component in a lighter style (`bg-surface text-ink`, border).

### 2.5 SOS sheet (from any driver screen)

Trigger: top bar button, 44 × 44, `bg-danger-soft text-danger`, `Siren` icon, `aria-label="SOS"`.

```
┌──────────────────────────────┐
│ Need help?                   │ text-h3
│ The event team will see your │
│ location and vehicle.        │
│                              │
│ What happened?               │
│ ( ) Medical                  │ radio list, 52px rows
│ ( ) Vehicle breakdown        │
│ ( ) Safety                   │
│ ( ) I'm lost                 │
│ ( ) Other                    │
│ [Add a note (optional)    ]  │
│                              │
│ [        Send SOS          ] │ danger lg
│ [  Call event help line    ] │ secondary md, tel: link
└──────────────────────────────┘
```

- Sends with current fix if available (else null).
- After send: sheet content becomes "Help request sent. Keep your phone with you." with the call button still visible. Existing open SOS: show the same sent state instead of the form.

---

## 3. Gate volunteer

### 3.1 Gate home `/gate`

```
┌──────────────────────────────┐
│ Main gate (▼)        [menu]  │  gate switcher (only gates allowed), menu: language, log out
├──────────────────────────────┤
│ Demo Fest                    │ text-body-sm text-muted
│                              │
│ [  Check in vehicle        ] │ primary lg with Camera icon
│ [  Vehicle leaving         ] │ secondary lg with LogOut icon
│ [  Find a vehicle          ] │ secondary lg with Search icon
│                              │
│ Free now                     │ text-h3
│ Cars   124   Bikes  60       │ 2-column list, type icon + count
│ EV     8     Buses  4        │
│                              │
│ Last check-ins               │ text-h3
│ [PlateChip sm] A-012  2m ago │ 5 rows, tap → vehicle sheet
└──────────────────────────────┘
```

- Selected gate is stored in `localStorage` key `eventpark.gate`.
- Data: `get_gate_overview` (section 3.6), refreshed on `db-slots` and `db-visits` realtime changes, debounced 2 s.

### 3.2 Check-in wizard `/gate/checkin`

Zustand store `features/gate/store.ts`, persisted in `sessionStorage` so a refresh does not lose progress:

```ts
type CheckinState = {
  step: 'photo' | 'details' | 'phone' | 'slot' | 'done';
  photoPaths: string[];
  aiStatus: 'idle' | 'uploading' | 'reading' | 'done' | 'failed' | 'skipped';
  ai: ExtractResult | null;
  details: { plateRaw: string; vehicleType: VehicleType; color: string; make: string; category: VisitorCategory;
             passNumber: string; passHolderName: string; needsAccessible: boolean };
  phone: { number: string; name: string; language: 'en' | 'ml' };
  slot: { id: string; label: string; zoneCode: string; zoneName: string } | null;
  fee: { amount: number; method: PaymentMethod };
  result: { visitId: string; link: string; waMessageId: string; waStatus: WaStatus } | null;
  reset(): void;
};
```

Top of every step: back icon (except photo), title, stepper bar "Step n of 4" (done has none). Cancel (X) in top-right asks "Discard this check-in?".

#### Step 1: Photo

```
┌──────────────────────────────┐
│ ✕  Check in        Step 1/4  │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │                          │ │  photo preview area 4:3, bg-surface-2
│ │  (Camera icon 32)        │ │  empty state text:
│ │  Take a photo of the     │ │  "Take a photo of the vehicle.
│ │  vehicle with the plate  │ │   Include the pass card if it's
│ │  and pass card visible   │ │   on the dashboard."
│ └──────────────────────────┘ │
│ [+ Add pass card photo]      │ link button, shows after first photo (max 2)
├──────────────────────────────┤
│ [       Take photo        ]  │ primary lg (label "Use photo" after capture)
│ [  Enter details manually ]  │ ghost md
└──────────────────────────────┘
```

- "Take photo" opens `<input type="file" accept="image/*" capture="environment">`.
- After capture: preview, buttons become "Use photo" (primary) and "Retake" (secondary).
- "Use photo": compress (max 1280 px, JPEG 0.8, ≤ 400 KB) → upload → `extract-vehicle`. Show progress text under preview: "Uploading…", then "Reading plate…". Move to details when done or failed. Failed shows the details step with an `Alert` "Couldn't read the photo. Enter details manually."
- "Enter details manually": `aiStatus = 'skipped'`, go to details.

#### Step 2: Details

```
┌──────────────────────────────┐
│ ←  Vehicle details  Step 2/4 │
├──────────────────────────────┤
│ [thumb 64] Read by AI        │ row: thumbnail + "Read by AI" + confidence text "High confidence"/"Check the plate"
│                              │
│ Number plate                 │
│ [ KL02AB1234            ]    │ input, font-display 24, uppercase, below: PlateChip lg live preview
│ (warning if invalid format:  │
│  "This doesn't look like an  │
│   Indian plate. Check it.")  │
│                              │
│ (Duplicate alert if active:  │
│  "Already checked in: A-012" │
│  [Open existing])            │
│                              │
│ Vehicle type                 │
│ [Bike][Car][EV][Bus][Other]  │ segmented, icons
│                              │
│ Visitor category             │
│ (VIP)(Guest)(Faculty)(Student)│ chips, single select
│ (Staff)(Volunteer)(Performer)│
│ (General)                    │
│                              │
│ [ ] Needs accessible parking │ switch row
│                              │
│ More details (collapsible)   │ colour, make, pass number, pass holder name
├──────────────────────────────┤
│ [          Next           ]  │ primary lg, disabled until plate (≥ 4 chars) and type
└──────────────────────────────┘
```

- Prefill from AI: plate, type, colour, make; category from `pass_category` when `pass_detected`; pass number, holder name.
- Confidence text: plate_confidence ≥ 0.85 "High confidence" (`text-success`), else "Check the plate" (`text-warning`) and the plate input gets a warning border.
- `ai_edited` = plate or type differs from AI result at submit.
- Duplicate check runs on plate blur and on Next (`find_active_visit_by_plate`). Alert has "Open existing" (opens the vehicle action sheet 3.5). Admin also sees "Continue anyway".

#### Step 3: Phone

```
┌──────────────────────────────┐
│ ←  Driver phone     Step 3/4 │
├──────────────────────────────┤
│ Mobile number                │
│ [+91 | 98765 43210      ]    │ numeric, auto-focus, formats 5+5
│ The parking link is sent on  │ helper text-muted
│ WhatsApp to this number.     │
│                              │
│ Name (optional)              │
│ [__________________]         │
│                              │
│ Message language             │
│ [ English | മലയാളം ]          │ segmented, default event.default_language
├──────────────────────────────┤
│ [          Next           ]  │ enabled when 10 valid digits
└──────────────────────────────┘
```

Validation: 10 digits, starts with 6–9. Error "Enter a valid 10-digit mobile number".

#### Step 4: Slot

```
┌──────────────────────────────┐
│ ←  Assign slot      Step 4/4 │
├──────────────────────────────┤
│ [PlateChip sm] Car  Guest    │ summary row
│                              │
│ Recommended                  │ text-caption text-muted
│ ┌──────────────────────────┐ │ selected card: border-primary, bg-primary-soft
│ │ [SlotLabel md A-012]  (●)│ │ radio on right
│ │ North lawn               │ │
│ │ 120 m from this gate     │ │
│ └──────────────────────────┘ │
│ Other free slots             │
│ ┌ A-013  North lawn  130 m ┐ │ 4 rows, radio each
│ ┌ C-002  VIP lot    210 m  ┐ │
│                              │
│ [Pick on map]                │ secondary md, opens full-screen map picker
│                              │
│ Zones: (A 34 free)(B 12)(C 3)│ chips filter suggestions to one zone
│                              │
│ Parking fee (paid events)    │ amount input + [Cash|UPI|Free] segmented
├──────────────────────────────┤
│ [    Assign and send       ] │ primary lg
└──────────────────────────────┘
```

- `fallback_used` messages under "Recommended": `overflow` "Main zones are full. Showing overflow parking."; `category_any` "No free slots for Guest. Showing other zones."; `accessible` "No accessible slot free. Showing nearest slots."
- Empty: "No free slots for this vehicle type." with "Pick on map" still available (shows everything, all taken).
- Map picker (full-screen sheet): event map with only slots of the matching type interactive, colour by status, tap an available slot to select (label pops up in a bottom bar with "Use this slot"). Non-matching slots dimmed.
- Fee row visible only if `event.paid_parking`; amount prefilled from `fee_rules[vehicle_type]`, forced to 0 and disabled for exempt categories with helper "Free for Faculty".
- "Assign and send" → `gate-checkin`. On `SLOT_TAKEN`: toast "That slot was just taken. Pick another." and refetch suggestions (stay on step). On success → done.

#### Step 5: Done

```
┌──────────────────────────────┐
│ Checked in              ✕    │
├──────────────────────────────┤
│ [SlotLabel xl  A-012]        │
│ North lawn                   │
│ [PlateChip md]               │
│                              │
│ WhatsApp  (status row)       │ icon + text, aria-live: Sending… / Sent / Delivered / Read / Failed
│                              │
│ ┌────────────┐               │
│ │  QR code   │ Driver can    │ QR 160 px (240 px when failed)
│ │            │ scan this to  │
│ └────────────┘ open the map  │
│                              │
│ (on failure: Alert danger    │
│  "WhatsApp message failed.   │
│   Ask the driver to scan     │
│   the QR code." [Resend])    │
├──────────────────────────────┤
│ [    Check in next vehicle ] │ primary lg → reset store, step photo
└──────────────────────────────┘
```

Realtime on `whatsapp_messages` row id. "Resend" calls `driver-resend-link` with the phone.

### 3.3 Exit `/gate/exit`

```
┌──────────────────────────────┐
│ ←  Vehicle leaving           │
├──────────────────────────────┤
│ [ Search plate or last 4 ]🔍 │ input, search as you type (debounce 300 ms)
│ [ Scan plate with camera  ]  │ secondary md: photo → extract-vehicle → fills search
│                              │
│ results: vehicle cards       │ only active visits
│ [PlateChip] A-012 Parked     │
│         [   Mark exit   ]    │ primary sm on the card
└──────────────────────────────┘
```

- Mark exit confirm dialog: "Mark KL 02 AB 1234 as left?" / "Mark exit". Toast "Marked as left".
- If paid parking and fee not recorded (`payment_method = 'free'` and fee rule > 0 and not exempt), dialog includes fee input and method before confirming. (Uses `mark_exit` only; fee update through RPC `set_visit_fee(p_visit_id, p_amount, p_method)` gate/admin.)

### 3.4 Find a vehicle `/gate/vehicles`

- Search input at top (same matching as exit). Filter chips: Active, Left, All.
- Result list: vehicle cards (PlateChip sm, slot, status badge, checked-in time). Tap → vehicle action sheet.

### 3.5 Vehicle action sheet (gate)

Bottom sheet, full snap:

```
[PlateChip lg]
[StatusBadge]  Slot A-012  North lawn
Phone +91 98765 43210   (tap to call)
Checked in 10:42 am at Main gate
Timeline (last 5 visit_events)

[ Resend link ]            secondary
[ Change slot ]            secondary → opens step-4-like slot picker, then visit-reassign
[ Mark exit ]              secondary
[ Cancel check-in ]        ghost danger (only assigned/en_route), reason input required
```

### 3.6 RPC used by gate home

`get_gate_overview(p_event_id uuid, p_gate_id uuid) returns jsonb` (role gate, admin): `{ free_by_type: {bike, car, ev, bus, other}, recent: [{visit_id, plate, slot_label, status, checked_in_at}] }` (last 5 at that gate). Add to migration `rpc_visits`.

---

## 4. Zone volunteer

### 4.1 Zone vehicles `/zone`

```
┌──────────────────────────────┐
│ Zone A  North lawn (▼) [menu]│ zone switcher when volunteer has >1 zone
├──────────────────────────────┤
│  34 free   6 coming          │ 4 counters in one bordered strip
│   2 waiting   52 parked      │
│                              │
│ [List | Map]                 │ segmented
│ [ Search plate          ]    │
│                              │
│ Tabs: Waiting (2) Coming (6) Parked (52)
│                              │
│ vehicle cards                │
└──────────────────────────────┘
```

Tabs:

| Tab | Statuses | Sort | Card actions |
|---|---|---|---|
| Waiting for you (default tab when count > 0) | driver_parked | oldest first | primary "Confirm", secondary "Wrong slot" |
| Coming | assigned, en_route | oldest first | secondary "Confirm parked", overflow menu: "Not here" |
| Parked | confirmed | newest first | overflow menu: "Mark exit", "Report" |

- Cards show PlateChip md, slot label, type icon + colour + make, category, status, relative time ("Assigned 6 min ago", "Marked parked 1 min ago"). Open alerts shown as warning badge: "Away from slot" (location_mismatch), "Late" (not_arrived).
- New item arriving in Waiting: sonner toast "KL 02 AB 1234 is waiting at A-012" and a short vibration (`navigator.vibrate(120)`) if allowed.
- Map view: zone map with slot colours, vehicles in `en_route` shown with their last position. Tap slot → sheet with the visit in that slot.
- Floating action button bottom-right (56 px, `bg-primary`, `TriangleAlert` icon, `aria-label="Report wrong parking"`) opens 4.3.
- Empty tabs: Waiting "No vehicles waiting. New ones appear here." Coming "No vehicles on the way." Parked "No vehicles parked yet."

### 4.2 Zone vehicle detail `/zone/visit/:id`

```
┌──────────────────────────────┐
│ ←  A-012                     │
├──────────────────────────────┤
│ [photo, 4:3, tap to zoom]    │ signed URL
│ [PlateChip lg]  [StatusBadge]│
│ Car   White   Maruti         │
│ Guest   Accessible (if true) │
│ Phone +91 98xxxxxx21         │ masked
│ Driver marked parked 2 min ago, 12 m from slot
│ Timeline                     │
├──────────────────────────────┤
│ [ Wrong slot ] [ Confirm ]   │ sticky bar, two buttons (secondary, primary)
└──────────────────────────────┘
```

- Confirm: no dialog (fast path), toast "Parking confirmed", back to list.
- Wrong slot: sheet with zone map and a list of available slots in own zones sorted by label, search by label. Select → "Confirm in B-004". Calls `zone_confirm_parked(visit, actual_slot)`. Toast "Moved to B-004 and confirmed".
- Not here (in overflow menu top-right): calls `zone_flag_not_here`, toast "Reported to admin".
- Mark exit (overflow menu, confirmed only).

### 4.3 Report wrong parking sheet

```
Report wrong parking               text-h3
[ Take photo ]                     required
Plate (optional) [__________]
What's wrong?
( ) Blocking a road
( ) In a no-parking area
( ) Taking two slots
( ) Other
Note [________________]
[ Send report ]                    primary
```

Uses current GPS fix (required; if unavailable show "Turn on location to report" and disable send). Message stored as the selected reason label + note. Toast "Report sent".

---

## 5. Admin

Admin shell from design system 5.2. Top bar contains: page title (left), event switcher (select with event name and status badge), alerts bell with open count (opens `/admin/alerts`), account menu (name, language, log out).

### 5.1 Dashboard `/admin`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Dashboard                                   Updated 10:42:18 am      │
├──────────────────────────────────────────────────────────────────────┤
│ Free 180 │ On the way 14 │ Waiting 6 │ Parked 210 │ Left 96 │ Alerts 5│  KPI strip
├───────────────────────────────────────────┬──────────────────────────┤
│                                           │ Tabs: Alerts | Activity  │
│  Live map (event fit, slots coloured,     │                          │
│  moving vehicles)                         │ alert rows / activity    │
│  height 520px                             │ rows, scroll             │
│  [Open live map] link top-right of map    │                          │
│                                           │                          │
├───────────────────────────────────────────┴──────────────────────────┤
│ Zones                                                                │
│ Zone      Types     Categories   Free  Assigned  Parked  Blocked  Occupancy │
│ A North   Car       All           34      4       22       0     ███████░ 43% │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ Gates (last 15 min)          │ WhatsApp                              │
│ Main gate  12 in  3 out      │ Sent 320  Delivered 300  Read 250     │
│ North gate  4 in  0 out      │ Failed 4 (link to vehicles filter)    │
└──────────────────────────────┴───────────────────────────────────────┘
```

- Grid: 12 columns, map 8 cols, side panel 4 cols. Below 1200 px the side panel moves under the map.
- KPI strip: one bordered container, 6 cells divided by vertical lines. Alerts cell turns `text-danger` when `sos_open > 0`.
- Alerts tab rows: icon, type label, plate or "Driver", zone, relative time, status badge; click opens alert drawer (5.4). SOS rows pinned on top with `bg-danger-soft`.
- Activity tab: "KL 02 AB 1234 confirmed at A-012" rows with time; click opens vehicle drawer.
- Zones table: occupancy bar 80 px wide, colour primary, text percent; click row → `/admin/zones?zone=<id>`.
- Sound: toggle in the Alerts tab header "Sound for SOS" (off by default; turning it on unlocks audio). When an SOS arrives and sound is on, play a short tone (Web Audio, 3 beeps).
- Data: `get_dashboard_summary` (refetch on realtime `visits`/`slots`/`alerts` changes, debounced 1 s), `get_recent_activity`, `get_live_vehicles` + positions channel.

### 5.2 Live map `/admin/live`

Full content area map.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Left floating panel 320px (collapsible)          Right controls      │
│ ┌─────────────────────────┐                      [zoom][layers]      │
│ │ Search plate [______]   │                                          │
│ │ Show: [x] Moving        │                                          │
│ │       [x] Waiting       │                                          │
│ │       [x] Traffic       │                                          │
│ │       [x] Roads         │                                          │
│ │ Moving vehicles (14)    │                                          │
│ │ [Plate]  A-012   20s ago│  list, click = fly to                   │
│ │ ...                     │                                          │
│ └─────────────────────────┘                                          │
│                                                                      │
│ Bottom-left legend: Free, Assigned, Waiting, Parked, Blocked;        │
│ traffic: Light, Busy, Jammed                                         │
└──────────────────────────────────────────────────────────────────────┘
```

Vehicle click popover per `05-MAPS-AND-NAVIGATION.md` section 9. Slot click popover: label, status, plate if any, actions "Block" / "Unblock" (available/blocked only), "Open vehicle".

### 5.3 Vehicles `/admin/vehicles`

- Toolbar: search (plate, phone last 4, pass number), filters: Status (multi), Zone (multi), Type (multi), Category (multi), Gate, Time range (today, custom); "Export" dropdown (Excel of current filter).
- Table columns: Plate (PlateChip sm), Type, Category, Slot, Zone, Status, Phone, Checked in, Parked, Left, Gate, WhatsApp (status icon). Default sort Checked in desc. 50 per page.
- Row click → vehicle drawer (right, 520 px):

```
[PlateChip lg]  [StatusBadge]
Photo (click to enlarge)
Details: type, colour, make, category, pass number, holder, accessible
Driver: phone (copy button), name, language
Parking: slot, zone, gate, fee and method
Timeline: visit_events list with actor and time
WhatsApp messages: template, status, time
Alerts for this vehicle
Trail: small map with position line (if any)
Actions (footer): Change slot, Resend link, Mark exit, Cancel check-in, Confirm parked
```

Actions follow the same state rules as backend. Disabled actions show a tooltip explaining why ("Only possible before the vehicle is parked").

### 5.4 Alerts `/admin/alerts`

- Tabs: Open (default), Acknowledged, Resolved. Filter by type and zone.
- List rows (not a table): type icon + label, message, plate chip if any, zone, raised by (Driver / volunteer name / System), time, status. SOS rows first.
- Click → drawer: map with alert location, all details, photo (wrong parking), vehicle summary with "Open vehicle", actions "Acknowledge" (open only), "Resolve" (with note textarea), for SOS "Call driver" (tel link).
- Realtime inserts: new row appears at top with a 2 s `bg-warning-soft` highlight.

### 5.5 Map editor `/admin/map-editor`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar: Map editor   [Street|Satellite]   Layers ▾   Warnings (2) ▾ │
│          [Save roads] (enabled when roads changed)   Saved 10:40 am  │
├────┬───────────────────────────────────────────────────┬─────────────┤
│Tool│                                                   │ Properties  │
│bar │                  map canvas                        │ panel 320px │
│56px│                                                   │             │
│    │                                                   │             │
│Sel │                                                   │             │
│Zone│                                                   │             │
│Row │                                                   │             │
│Slot│                                                   │             │
│Road│                                                   │             │
│Gate│                                                   │             │
│Land│                                                   │             │
│Img │                                                   │             │
│Del │                                                   │             │
├────┴───────────────────────────────────────────────────┴─────────────┤
│ Status bar: Zone A active   42 slots   Snapping on   lng, lat        │
└──────────────────────────────────────────────────────────────────────┘
```

Toolbar: 44 × 44 icon buttons with tooltips and keyboard shortcuts: Select `V`, Zone `Z`, Slot row `R`, Single slot `S`, Road `D`, Gate `G`, Landmark `L`, Image overlay `I`, Delete selected `Backspace`. Active tool `bg-primary-soft text-primary`.

Properties panel by selection:

| Selection | Panel content |
|---|---|
| Nothing | Event summary: zones count, slots count by type, roads length, gates. Instructions: "Pick a tool on the left to start drawing." |
| Zone | Code, Name, Name (Malayalam), Colour (8 swatches), Vehicle types (checkboxes), Visitor categories (chips; none = all), Overflow zone switch, Priority (number, "Lower is used first"), Notes. Stats: slots, free, accessible. Buttons: "Save zone", "Delete zone" (danger ghost) |
| Slot row preview | Generator form (section 4 of maps doc) with live preview. Buttons: "Add slots", "Cancel" |
| Slot(s) | Label(s), Vehicle type, Accessible switch, EV charger switch, Status (Available/Blocked with reason). Multi-select shows "12 slots selected" and bulk fields. Buttons "Save slots", "Delete slots" |
| Road | Name, Direction segmented [Two-way, One-way], "Reverse direction", Footpath only switch. Note "Roads save together with Save roads." |
| Gate | Name, Name (Malayalam), Kind segmented [Entry, Exit, Both]. "Save gate", "Delete gate" |
| Landmark | Name, Name (Malayalam), Kind select. Save, Delete |
| Overlay | Upload image, Opacity slider, Visible switch, "Place corners" instructions, Save, Remove |

Rules:
- Slot tools require an active zone: clicking inside a zone sets it active; if none, the tool shows toast "Select a zone first".
- Unsaved features are drawn dashed; panel shows "Not saved" in `text-warning`.
- Warnings dropdown lists connectivity warnings and invalid features; clicking one flies to it.
- Leaving with unsaved changes → confirm dialog "Leave without saving?".
- Editing while the event is live shows a persistent info bar: "The event is live. Changes apply to drivers immediately."

### 5.6 Zones and slots `/admin/zones`

- Left: zones list (320 px): colour bar, code, name, free/total, types icons. "Open in map editor" link.
- Right: selected zone detail: header with zone name and "Edit in map editor" secondary button; rules summary; slots table with checkbox selection: Label, Type, Accessible, EV, Status, Current vehicle, Since. Bulk actions bar appears on selection: "Block", "Unblock", "Set type", "Mark accessible", "Unmark accessible". Block asks for a reason.

### 5.7 Staff `/admin/staff`

- Toolbar: search, role filter, "Add staff" primary.
- Table: Name, Username, Role (badge), Zones/Gates (codes), Phone, Status (Active/Off), Last seen. Row actions menu: Edit, Reset password, Turn off / Turn on.
- Add/Edit dialog: Full name, Username (create only; helper "Lowercase letters, numbers, dots, underscores"), Role select (Admin, Gate volunteer, Zone volunteer), Phone, Zones (multi-select, zone volunteers), Gates (multi-select, gate volunteers, "Leave empty for all gates"), Password (create only) with "Generate" button that fills a 10-char password and shows it with a copy button. Save → `admin-staff`.
- After creating: dialog shows "Share these sign-in details" with username and password and a "Copy" button, then "Done".

### 5.8 Reports `/admin/reports`

Defined fully in `09-REPORTS.md` section 5. Layout: filter bar (Event, Date range, Zones, Interval 15/30/60 min), tabs (Occupancy, Peak hours, Revenue, Vehicle counts), each tab = chart on top + table below. Top-right: "Export Excel", "Export PDF".

### 5.9 Assistant `/admin/assistant`

```
┌──────────────────────────────────────────────────────────────────────┐
│ Assistant                                        [New chat]          │
├──────────────────────────────────────────────────────────────────────┤
│  (empty state)                                                       │
│  Ask about parking right now.                                        │
│  (Which zone is almost full?) (Where is KL02AB1234?)                 │  suggestion chips
│  (How many bikes came in the last hour?) (Any open SOS?)             │
│                                                                      │
│  messages: user right-aligned bg-primary-soft, assistant left plain │
│  under assistant message: "Used: zone occupancy, find vehicle"      │  text-caption, expandable
├──────────────────────────────────────────────────────────────────────┤
│ [ Ask a question…                                   ] [Send]         │
└──────────────────────────────────────────────────────────────────────┘
```

Max width 760 px centered. Assistant replies rendered with react-markdown (tables allowed). While waiting, show "Looking at the data…" in `text-muted` under the last message.

### 5.10 Events `/admin/events`

- Table: Name, Dates, Status badge, Zones, Slots, Vehicles. Actions: Edit, Set live, Close, Open map editor.
- Create/Edit dialog: Name, Venue, Starts at, Ends at (datetime, IST), Default language, Map center (button "Pick on map" opens small map to click center), Default zoom.
- "Set live" confirm: "Set Demo Fest live? Gate and zone volunteers will start using it." Fails if another event is live: "Close Tech Fest first."
- "Close" confirm: "Close Demo Fest? Driver links stop working."

### 5.11 Settings `/admin/settings`

Sections (single page, left anchor nav on wide screens):

1. Event: paid parking switch; fee per vehicle type (5 number inputs, INR); free categories (chips).
2. Timings: arrival timeout (min), confirmation timeout (min), overstay after event end (min).
3. Location: arrival radius (m), location tolerance (m).
4. Emergency: help line phone; admin phones for SOS WhatsApp (list with add/remove).
5. Map: default base map (Street/Satellite).
6. WhatsApp: "Send test message" (phone input + template select + send; shows API response status).
7. Language: default message language.

Each section has its own "Save" button (secondary until dirty, then primary). Saved toast "Settings saved".