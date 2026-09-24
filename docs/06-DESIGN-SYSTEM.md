# 06. Design System

## 1. Direction

Clean, modern, light. It should look like a well-made utility, the way a good transit or maps app looks: calm surfaces, one clear blue for actions, colour used only for status, and big legible labels that work in bright sunlight on a cheap phone.

The one distinctive element is how vehicles and slots are shown: the **plate chip** (styled like an Indian number plate) and the **slot label** (large condensed numerals like a painted bay marking). Everything else stays quiet.

Things this design does not do:

- No dark theme in v1, no gradients, no glass blur, no glowing shadows, no illustrations, no emoji.
- No decorative icons next to headings. Icons appear only where they carry meaning (vehicle type, status, actions).
- No eyebrow labels above headings, no ALL CAPS, no middle-dot separators, no arrows appended to button text.
- No identical card grids for everything. Lists are lists, tables are tables, and cards are used only for a single object (a vehicle, a slot).
- No marketing copy. The app never describes itself.

## 2. Tokens

Defined once in `src/styles/theme.css` with Tailwind v4 `@theme`. Components use the Tailwind utilities these tokens generate (`bg-surface`, `text-muted`, `border-line`, `bg-status-available`, and so on). No other colour values anywhere.

```css
@import "tailwindcss";

@theme {
  /* Neutrals */
  --color-canvas: #F4F6F9;          /* app background */
  --color-surface: #FFFFFF;          /* cards, sheets, panels */
  --color-surface-2: #EEF1F5;        /* subtle fills, table header, segmented control track */
  --color-line: #E1E5EB;             /* default borders, dividers */
  --color-line-strong: #C9CFD8;      /* input borders */
  --color-ink: #162033;              /* primary text */
  --color-muted: #5A6475;            /* secondary text */
  --color-subtle: #8A93A3;           /* placeholders, disabled text */

  /* Action */
  --color-primary: #1F4FD6;
  --color-primary-hover: #1942B5;
  --color-primary-soft: #E7EDFC;     /* selected rows, active nav */
  --color-on-primary: #FFFFFF;
  --color-focus: #6E8FF0;            /* focus ring */

  /* Feedback */
  --color-danger: #D63B3B;
  --color-danger-soft: #FCEAEA;
  --color-warning: #B7791F;
  --color-warning-soft: #FDF3E1;
  --color-success: #1E8E52;
  --color-success-soft: #E4F4EA;

  /* Status (slots and visits) */
  --color-status-available: #1E9E5A;
  --color-status-assigned: #0E9FB8;
  --color-status-enroute: #7A4FE0;
  --color-status-waiting: #E3A008;   /* driver_parked, awaiting volunteer */
  --color-status-occupied: #4B5566;  /* confirmed / occupied */
  --color-status-blocked: #A3ABB8;
  --color-status-exited: #A3ABB8;

  /* Soft backgrounds for status badges */
  --color-status-available-soft: #E3F4EA;
  --color-status-assigned-soft: #E0F4F7;
  --color-status-enroute-soft: #EFE9FC;
  --color-status-waiting-soft: #FDF4DC;
  --color-status-occupied-soft: #E9EBEF;
  --color-status-blocked-soft: #EEF0F3;

  /* Zone palette (outline + 10% fill on maps, left bar on labels) */
  --color-zone-1: #3B6FE0;
  --color-zone-2: #E07B39;
  --color-zone-3: #C2477F;
  --color-zone-4: #2A9D8F;
  --color-zone-5: #B08900;
  --color-zone-6: #6D5BD0;
  --color-zone-7: #4C8C2B;
  --color-zone-8: #D1495B;

  /* Map-only */
  --color-map-road: #7C8698;
  --color-map-route: #1F4FD6;
  --color-traffic-medium: #E3A008;
  --color-traffic-high: #D63B3B;

  /* Type */
  --font-sans: "Manrope Variable", "Noto Sans Malayalam", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Barlow Semi Condensed", "Noto Sans Malayalam", ui-sans-serif, sans-serif;

  /* Radius (varies by hierarchy on purpose) */
  --radius-xs: 4px;    /* plate chip, small tags */
  --radius-sm: 6px;    /* badges */
  --radius-md: 10px;   /* buttons, inputs */
  --radius-lg: 14px;   /* cards, panels, dialogs */
  --radius-xl: 20px;   /* bottom sheet top corners */

  /* Shadows: only these two */
  --shadow-raised: 0 1px 2px rgb(22 32 51 / 0.06), 0 1px 1px rgb(22 32 51 / 0.04);
  --shadow-overlay: 0 10px 28px rgb(22 32 51 / 0.14), 0 2px 6px rgb(22 32 51 / 0.06);
}
```

Tokens are exported for map code in `src/features/map/style/colors.ts` (same values, same names in camelCase). That file and `theme.css` are the only places allowed to contain hex values.

## 3. Typography

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `text-display` | 56 / 60, font-display | 700 | Slot label on driver home and gate done screen |
| `text-h1` | 28 / 34 | 700 | Page title (admin), big numbers |
| `text-h2` | 22 / 28 | 700 | Section title, mobile page title |
| `text-h3` | 18 / 24 | 600 | Card title, sheet title |
| `text-body` | 16 / 24 | 500 | Default on mobile |
| `text-body-sm` | 14 / 20 | 500 | Default in admin tables, secondary text |
| `text-caption` | 12 / 16 | 600 | Badges, meta, axis labels |
| `text-plate` | 20 / 24, font-display | 700, tracking 0.06em | Plate chip (md) |

Malayalam: Noto Sans Malayalam. Increase line height by 4 px when `lang="ml"` on `html` (`:lang(ml)` rule in `globals.css`) because Malayalam glyphs are taller. Never set Malayalam in `font-display`; the fallback handles it.

Numbers in tables and KPIs use `font-variant-numeric: tabular-nums` (`tabular-nums` utility).

Minimum text size on mobile screens is 14 px. Body text on driver and volunteer screens is 16 px.

## 4. Status system

Every status has a colour, a soft background, a lucide icon, and a label. Colour is never the only signal.

| Status | Where | Colour token | Icon | Label (en) |
|---|---|---|---|---|
| available | slot | status-available | `Square` | Free |
| assigned | slot, visit | status-assigned | `Bookmark` | Assigned |
| en_route | visit | status-enroute | `Navigation` | On the way |
| driver_parked | visit | status-waiting | `Hourglass` | Waiting for check |
| occupied | slot | status-occupied | `Car` / `Bike` / `Bus` by type | Parked |
| confirmed | visit | status-occupied | `CircleCheck` | Parked |
| blocked | slot | status-blocked + hatch on map | `Ban` | Blocked |
| exited | visit | status-exited | `LogOut` | Left |
| cancelled | visit | status-exited | `CircleX` | Cancelled |

Alert types: `sos` danger + `Siren`; `wrong_slot`, `wrong_parking`, `location_mismatch` warning + `TriangleAlert`; `not_arrived`, `confirm_pending`, `overstay` muted + `Clock`.

Vehicle type icons: bike `Bike`, car `Car`, ev `Zap`, bus `Bus`, other `Truck`. Accessible `Accessibility`. EV charger `PlugZap`.

## 5. Layout

### 5.1 Mobile shell (driver, gate, zone) — designed at 360 × 740

```
┌──────────────────────────────┐
│ Top bar 56px                 │  title left, 1-2 icon buttons right
├──────────────────────────────┤
│                              │
│ Content, 16px side padding   │
│ vertical rhythm 16 / 24      │
│                              │
├──────────────────────────────┤
│ Sticky action bar 72px       │  primary button full width (h-13 = 52px)
└──────────────────────────────┘
```

- Safe-area padding at the bottom through a `pb-safe` utility defined in `globals.css` (`padding-bottom: env(safe-area-inset-bottom)`).
- Map screens: map is full-bleed under a transparent top bar; controls float at 12 px from edges on `bg-surface` with `shadow-overlay`, radius `lg`.
- Bottom sheets (vaul) have three snap points: peek 120 px, half 50%, full 92%.

### 5.2 Admin shell — designed at 1280 × 800, works to 1024

```
┌────────┬──────────────────────────────────────────────┐
│Sidebar │ Top bar 56px: page title, event switcher,    │
│ 232px  │ alerts bell with count, account menu         │
│        ├──────────────────────────────────────────────┤
│ nav    │ Content, 24px padding, max-width 1440        │
│        │                                              │
└────────┴──────────────────────────────────────────────┘
```

- Sidebar: `bg-surface`, right border `line`. Items 40 px tall, icon 18 px + label, active item `bg-primary-soft text-primary`. Collapses to 64 px icons-only below 1200 px.
- Nav order: Dashboard, Live map, Vehicles, Alerts, Map editor, Zones and slots, Staff, Reports, Assistant, Events, Settings.

### 5.3 Grid and spacing

4 px base. Use spacing steps 1, 2, 3, 4, 6, 8, 10, 12 (4 to 48 px). Section gap on admin pages 24 px; inside cards 16 px.

## 6. Components

All built on shadcn/ui and restyled with the tokens above. Files in `src/components/ui/` (shadcn) and `src/components/common/` (app-specific).

### Button

| Variant | Style |
|---|---|
| primary | `bg-primary text-on-primary`, hover `bg-primary-hover` |
| secondary | `bg-surface border border-line-strong text-ink`, hover `bg-surface-2` |
| ghost | transparent, hover `bg-surface-2` |
| danger | `bg-danger text-white` |
| link | `text-primary underline-offset-4 hover:underline` |

Sizes: `lg` 52 px (mobile primary actions), `md` 44 px (default mobile), `sm` 36 px (admin default, table actions), `icon` 44 × 44 mobile / 36 × 36 admin. Radius `md`. Text 16/600 (lg, md), 14/600 (sm). Loading state: spinner replaces the leading icon, label stays, button disabled.

One primary button per screen or sheet.

### Input, Select, Textarea

Height 48 px mobile, 40 px admin. `bg-surface border border-line-strong rounded-md`. Focus: 2 px ring `focus`. Error: border `danger`, message below in `text-danger text-body-sm`. Labels above the field, 14/600, `text-ink`. Helper text 14/500 `text-muted`.

### Segmented control

For vehicle type, language, base map. Track `bg-surface-2 rounded-md p-1`, active segment `bg-surface shadow-raised text-ink`, inactive `text-muted`. Each segment ≥ 44 px tall on mobile, icon + label.

### Chip (selectable)

For visitor category and zone filters. 36 px tall, radius `sm`, border `line-strong`. Selected: `bg-primary-soft border-primary text-primary`. Multi-line wrap, 8 px gap.

### StatusBadge (`common/StatusBadge.tsx`)

`<StatusBadge status="driver_parked" />`. Height 24 px, padding 8 px, radius `sm`, soft background + strong text colour of the status, 14 px icon, `text-caption`.

### PlateChip (`common/PlateChip.tsx`)

The signature element.

```
┌─┬──────────────────┐
│I│  KL 02 AB 1234   │
│N│                  │
│D│                  │
└─┴──────────────────┘
```

- White background, 1.5 px `ink` border, radius `xs`.
- Left strip 14 px wide, `bg-primary`, with "IND" vertical in 8 px white (hidden in `sm` size).
- Plate text in `font-display` 700, tracking 0.06em, `text-ink`. Display formatting via `formatPlate()` in `lib/format.ts` (inserts spaces: `KL 02 AB 1234`, `22 BH 1234 AA`).
- Sizes: `sm` 28 px tall (tables, lists), `md` 36 px (cards), `lg` 52 px (gate review, zone detail).

### SlotLabel (`common/SlotLabel.tsx`)

- Zone colour bar 6 px wide on the left, radius `xs`.
- Label in `font-display`: `sm` 18 px, `md` 28 px, `xl` = `text-display` 56 px.
- Under the label (md, xl only): zone name in `text-body-sm text-muted`.
- Accessible and EV icons after the label when true.

### Vehicle card (`common/VehicleCard.tsx`) — used in zone and gate lists

```
┌────────────────────────────────────────────┐
│ [PlateChip md]              [StatusBadge]  │
│ Car  White  Maruti          Slot A-012     │
│ Guest            Assigned 6 min ago        │
│ [ Secondary action ]   [ Primary action ]  │
└────────────────────────────────────────────┘
```

`bg-surface rounded-lg border border-line p-4`. No shadow in lists. Actions appear only where the page spec says. Rows of meta text are separate spans with 12 px gap, never joined by dots.

### KPI tile (admin dashboard)

Number `text-h1 tabular-nums`, label `text-body-sm text-muted` below it, optional delta line `text-caption`. Tiles sit in a single bordered strip divided by vertical `line` rules, not as separate floating cards.

### Table (admin)

shadcn Table. Header `bg-surface-2 text-caption text-muted` (sentence case), rows 44 px, `border-b border-line`, hover `bg-canvas`, selected `bg-primary-soft`. Numbers right-aligned tabular. Sticky header. Pagination bottom right: "1–50 of 328".

### Dialog, Sheet, Drawer

- Dialog: max-width 480 px, radius `lg`, `shadow-overlay`, title `text-h3`, footer buttons right-aligned (admin) or full-width stacked (mobile).
- Admin detail drawer: right side, 520 px.
- Mobile bottom sheet: vaul Drawer, grabber 36 × 4 px `bg-line-strong`.

### Toasts (sonner)

Bottom-center on mobile, bottom-right on admin. One line, max two. Success toasts only for actions without a visible result on screen.

### Empty state (`common/EmptyState.tsx`)

Title `text-h3`, one line of guidance `text-muted`, optional one button. No illustration.

### Offline banner

Full-width bar under the top bar, `bg-warning-soft text-warning`, "You're offline. Changes will fail until you reconnect." Appears when `navigator.onLine` is false or Supabase realtime is disconnected for more than 5 s.

### Stepper (gate check-in)

Thin progress bar at the top of the content (4 px, `bg-primary` on `bg-surface-2`) plus "Step 2 of 4" in `text-caption text-muted`. No numbered circles.

### Map controls

Floating stack at right, 12 px from edge: zoom in, zoom out, recenter, layers. Each 44 × 44, `bg-surface rounded-md shadow-overlay`, icon 20 px `text-ink`. Grouped buttons share one container with `line` dividers.

## 7. Map visual rules

| Element | Style |
|---|---|
| Zone | 2 px outline in zone colour, fill same colour 10% |
| Zone label | zone name + free count on two lines, 13 px 600, white halo 1.5 |
| Slot | fill by status (section 4), 1 px white outline |
| Highlighted slot | 3 px `primary` outline plus a 1.6 s pulse on outline opacity (only motion on the map) |
| Road (admin/editor) | 6 px `map-road` on 9 px white casing |
| One-way arrow | white arrow icon on the road, every 40 px |
| Route | 7 px `map-route` on 11 px white casing, rounded joins |
| Route legs | 3 px dashed `map-route` |
| User puck | 16 px `primary` dot, 3 px white ring, accuracy circle `primary` 12% fill, heading cone 60° when heading known |
| Vehicles (admin) | 7 px circle, status colour, 2 px white stroke |
| Gate | 28 px white circle with `DoorOpen` icon in `ink` |
| Landmark | 24 px white circle with kind icon, name label from zoom 17 |

## 8. Motion

- Sheet and dialog open/close: 200 ms ease-out, respect `prefers-reduced-motion`.
- Highlighted slot pulse on the map (driver screens only).
- Arrival sheet slides up once.
- No entrance animations on page load, no hover lifts, no skeleton shimmer (static skeleton blocks `bg-surface-2` are fine).

## 9. Copy rules

- Sentence case everywhere: buttons, titles, table headers, tabs.
- Buttons say what happens: "Assign and send", "Confirm parked", "Mark as parked", "Send SOS", "Save zone". The toast for an action repeats the verb: "Slot assigned", "Parking confirmed".
- No separators made of middle dots, pipes, or em dashes between meta items. Put meta items in separate elements with spacing.
- No arrows in text ("Continue" not "Continue →").
- No filler: no "Welcome back!", "Let's get started", "Seamless", "Effortless". Titles are nouns: "Vehicles", "Alerts", "Your parking".
- Errors say what happened and what to do: "That slot was just taken. Pick another."
- Numbers: `formatDistance` (`40 m`, `1.2 km`), times relative under 1 hour ("6 min ago"), else `h:mm a` in IST.
- Use "vehicle", not "car", unless the type is car.
- Malayalam copy is written for the same meaning, not word-for-word. Keep English plate numbers and slot labels as is inside Malayalam text.

## 10. Accessibility

- Contrast: text AA (4.5:1), large text and icons 3:1. All status text colours on their soft backgrounds are checked; if a new token is added, verify it.
- Touch targets 44 × 44 minimum, primary mobile actions 52 px.
- Focus ring on every interactive element: `ring-2 ring-focus ring-offset-2 ring-offset-surface`.
- Map information is always available in text as well (slot label, zone name, directions list).
- `aria-live="polite"` on navigation instruction text and on WhatsApp status on the gate done screen.
- Honour `prefers-reduced-motion` (disable pulse and sheet animation).

## 11. Icons

lucide-react only, stroke width 1.75, sizes 16 (inline), 20 (buttons, controls), 24 (top bar). Icons in `text-muted` unless they are status icons or inside a primary button.
