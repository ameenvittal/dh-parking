# 02. Architecture

## 1. System overview

```
┌──────────────────────────── Browser (PWA, one Vite app) ────────────────────────────┐
│  /driver/*        /gate/*          /zone/*          /admin/*                        │
│  MapLibre + routing (ngraph)  TanStack Query  zustand  i18next                      │
└───────┬───────────────┬───────────────────┬───────────────────────┬────────────────┘
        │ supabase-js   │ Realtime          │ Storage (photos)      │ fetch
        ▼               ▼                   ▼                       ▼
┌──────────────────────────────────── Supabase ───────────────────────────────────────┐
│ Postgres 15 + PostGIS   RLS   RPC functions (SECURITY DEFINER)   pg_cron   pg_net     │
│ Auth (custom access token hook adds app_role claims)                                │
│ Realtime: postgres_changes (visits, slots, alerts, whatsapp_messages)               │
│           broadcast private channel event:<id>:positions                           │
│ Storage buckets: vehicle-photos, alert-photos, map-overlays                          │
│ Edge Functions (Deno): gate-checkin, extract-vehicle, driver-login,                  │
│   driver-resend-link, visit-reassign, whatsapp-webhook, alert-dispatch,             │
│   admin-staff, admin-assistant                                                      │
└────────────────────┬─────────────────────────────────────┬──────────────────────────┘
                     ▼                                     ▼
            WhatsApp Cloud API (Meta)                Google Gemini API
```

## 2. Why these choices

| Need | Choice | Reason |
|---|---|---|
| Base map, free | MapLibre GL JS + OpenFreeMap vector tiles | Open source, no API key, no usage bill, vector styling |
| Satellite view | MapTiler Satellite (free tier key) | Campus buildings in Kerala are often missing from OSM. Satellite lets the admin draw slots on real ground |
| Custom map (drone photo or site plan) | MapLibre `image` source | Admin places the image on 4 corners. Works without internet map data |
| Drawing zones, slots, roads | Terra Draw + MapLibre adapter | Actively maintained, supports polygon, rectangle, line, point, select, drag, rotate |
| Geometry math | Turf.js | Slot generation, area, intersections, distances, bearings |
| Routing with one-way roads | Own road graph + ngraph.path (A*) in browser | Campus roads are not in public routing engines. No API cost. Directed edges give one-way support |
| Spatial storage | PostGIS | Distance to slot, point in polygon, validation on the server |
| Live positions | Supabase Realtime broadcast (private channel) + throttled table insert | Broadcast is cheap for high frequency; table gives history for the admin trail |
| Plate and card reading | Gemini with JSON schema output | Reads plate, vehicle, and pass card in one call |
| Messaging | WhatsApp Cloud API (direct, not a BSP) | Lowest cost, template buttons with dynamic URL |

## 3. Libraries (the only ones allowed)

Pin exact versions at scaffold time with `pnpm add <pkg>@<major>` and commit the lockfile.

### App runtime

| Package | Major | Use |
|---|---|---|
| react, react-dom | 19 | UI |
| react-router | 7 | Routing (library mode, `createBrowserRouter`) |
| @supabase/supabase-js | 2 | Database, auth, realtime, storage, functions |
| @tanstack/react-query | 5 | Server state |
| zustand | 5 | Gate wizard store, map editor store, live location store |
| react-hook-form | 7 | Forms |
| zod | 4 | Schemas |
| @hookform/resolvers | 5 | zod resolver |
| tailwindcss, @tailwindcss/vite | 4 | Styling |
| shadcn/ui (copied components) + radix-ui | latest | Button, Input, Dialog, Sheet, Drawer, Tabs, Select, Popover, Command, Table, Badge, Switch, Toggle Group, Tooltip, DropdownMenu, Skeleton, ScrollArea, Separator, Alert, Progress |
| class-variance-authority, clsx, tailwind-merge | latest | Component variants, `cn()` helper |
| lucide-react | latest | Icons |
| sonner | 2 | Toasts |
| vaul | 1 | Mobile bottom sheets (used by shadcn Drawer) |
| maplibre-gl | 5 | Map rendering |
| react-map-gl | 8 | React bindings (`react-map-gl/maplibre`) |
| terra-draw, terra-draw-maplibre-gl-adapter | 1 | Map editor drawing |
| @turf/turf | 7 | Geometry |
| ngraph.graph, ngraph.path | 20, 1 | Road graph and A* |
| i18next, react-i18next, i18next-browser-languagedetector, i18next-resources-to-backend | 25, 15, 8, 1 | Translations, lazy namespaces |
| libphonenumber-js | 1 | Phone validation (IN) |
| date-fns, date-fns-tz | 4, 3 | Dates, Asia/Kolkata formatting |
| browser-image-compression | 2 | Resize photos before upload |
| qrcode.react | 4 | QR fallback on gate done screen |
| recharts | 3 | Report charts |
| exceljs | 4 | Excel export |
| jspdf, jspdf-autotable | 3, 5 | PDF export |
| react-markdown | 10 | Render assistant replies |
| vite-plugin-pwa | 1 | PWA manifest and service worker |
| @fontsource-variable/manrope, @fontsource/noto-sans-malayalam, @fontsource/barlow-semi-condensed | latest | Self-hosted fonts |

**Demo mode note (PRD decision 16).** In demo mode these listed packages are not installed yet, because nothing in the browser build needs them: `react-map-gl` (the map uses `maplibre-gl` directly in `BaseMap`), `terra-draw` and its adapter (not installed yet; the map editor adds it here with a reason if it needs it), `libphonenumber-js` (`src/lib/phone.ts` implements the same IN rule: 10 digits starting 6 to 9), `i18next-resources-to-backend` (a small `import.meta.glob` backend in `src/lib/i18n.ts` does the same job), and `browser-image-compression` (the demo photo store in `src/lib/demo/photos.ts` resizes with a canvas). `@supabase/supabase-js` stays installed for the switch back to Supabase. Nothing outside this list was added.

### Dev

vite 8 (the app build; vitest 3 runs with its own Vite 7 through `vitest.config.ts`), @vitejs/plugin-react, typescript 6, oxlint (in place of eslint 9 and its plugins; `pnpm i18n:check` covers the literal-string rule's intent for keys), Node 24 type stripping for scripts (in place of tsx), prettier 3 + prettier-plugin-tailwindcss, vitest 3, @testing-library/react 16, @testing-library/user-event, jsdom, @playwright/test, supabase (CLI as dev dependency).

### Edge Functions (Deno, imported with `npm:` or `jsr:`)

`jsr:@supabase/supabase-js@2`, `npm:@google/genai`, `npm:zod@4`. Shared code in `supabase/functions/_shared/`.

## 4. Folder structure

```
eventpark/
├── AGENTS.md
├── README.md
├── docs/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── .env.example
├── public/
│   ├── icons/                 # PWA icons 192, 512, maskable
│   └── map/arrow-sdf.png      # one-way arrow icon
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── router.tsx         # all routes, guards
│   │   ├── providers.tsx      # QueryClient, i18n, Toaster, AuthProvider
│   │   ├── RoleGuard.tsx
│   │   └── ErrorBoundary.tsx
│   ├── config/
│   │   └── app.ts             # APP_NAME, defaults
│   ├── styles/
│   │   ├── theme.css          # Tailwind @theme tokens (only place for raw values)
│   │   └── globals.css
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── queryClient.ts
│   │   ├── queryKeys.ts
│   │   ├── i18n.ts
│   │   ├── format.ts          # dates, distance, currency, plate display
│   │   ├── phone.ts           # normalizeIndianPhone, maskPhone
│   │   ├── plate.ts           # normalizePlate, isValidIndianPlate
│   │   ├── schemas/           # zod schemas shared by forms and API
│   │   ├── realtime.ts        # channel helpers
│   │   └── geo/
│   │       ├── slotGenerator.ts
│   │       ├── roadGraph.ts
│   │       ├── routing.ts
│   │       ├── instructions.ts
│   │       ├── snapping.ts
│   │       └── validation.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useLiveLocation.ts
│   │   ├── useWakeLock.ts
│   │   ├── useOnlineStatus.ts
│   │   └── useCurrentEvent.ts
│   ├── components/
│   │   ├── ui/                # shadcn components only
│   │   └── common/            # PlateChip, SlotBadge, StatusBadge, EmptyState, PageHeader, OfflineBanner, LanguageSwitch, ConfirmDialog, KeyValue
│   ├── features/
│   │   ├── auth/              # StaffLoginPage, DriverTokenPage, DriverLoginPage, api.ts
│   │   ├── map/               # shared: BaseMap, layers, style/, EventMapLayers, UserPuck, RouteLayer
│   │   ├── driver/            # DriverHomePage, NavigatePage, FindVehiclePage, SosSheet, api.ts
│   │   ├── gate/              # GateHomePage, CheckinPage (steps/), ExitPage, GateVehiclesPage, store.ts, api.ts
│   │   ├── zone/              # ZoneHomePage, ZoneVisitPage, ReportParkingSheet, api.ts
│   │   └── admin/
│   │       ├── layout/        # AdminShell, Sidebar, Topbar
│   │       ├── dashboard/
│   │       ├── live/
│   │       ├── map-editor/    # EditorPage, tools/, panels/, store.ts
│   │       ├── zones/
│   │       ├── visits/
│   │       ├── alerts/
│   │       ├── staff/
│   │       ├── reports/
│   │       ├── assistant/
│   │       ├── events/
│   │       └── settings/
│   ├── locales/
│   │   ├── en/{common,driver,gate,zone,admin,map,reports,errors}.json
│   │   └── ml/{same files}
│   └── types/
│       ├── database.ts        # generated, never edit
│       └── domain.ts          # hand-written domain types (Visit, SlotSuggestion, MapData...)
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   ├── migrations/            # created only via `supabase migration new`
│   ├── tests/                 # pgTAP tests (*.test.sql)
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts
│       │   ├── auth.ts        # requireRole(req, roles[])
│       │   ├── supabaseAdmin.ts
│       │   ├── whatsapp.ts    # sendTemplate, sendText, verifySignature
│       │   ├── gemini.ts
│       │   ├── tokens.ts      # createToken, hashToken
│       │   ├── phone.ts
│       │   ├── errors.ts      # AppError, jsonError
│       │   └── rateLimit.ts
│       ├── gate-checkin/index.ts
│       ├── extract-vehicle/index.ts
│       ├── driver-login/index.ts
│       ├── driver-resend-link/index.ts
│       ├── visit-reassign/index.ts
│       ├── whatsapp-webhook/index.ts
│       ├── alert-dispatch/index.ts
│       ├── admin-staff/index.ts
│       └── admin-assistant/index.ts
└── tests/
    ├── unit/                  # vitest (geo, plate, phone, instructions)
    └── e2e/                   # playwright
```

## 5. Authentication model

### 5.1 Staff

- Created only by an admin through the `admin-staff` Edge Function.
- Supabase Auth user with email `<username>@staff.eventpark.local`, `email_confirm: true`, password set by admin.
- Login form asks for username and password; the client builds the email and calls `signInWithPassword`.
- Row in `profiles` with `role`, `zone_ids`, `gate_ids`, `is_active`.
- The first admin is created by `supabase/seed.sql` locally and by the one-time script in `docs/11-SETUP-DEPLOY-QA.md` in production.

### 5.2 Drivers

1. At check-in, `gate-checkin` finds or creates a `drivers` row by `(event_id, phone_e164)`. New drivers get an Auth user with email `d_<driver_id>@drivers.eventpark.local` (no password).
2. It creates a random 32-byte token, stores `sha256(token)` in `driver_access_tokens` with `expires_at = event.ends_at + 6 hours`, and puts the raw token in the WhatsApp button URL: `https://<APP_URL>/d/<token>`.
3. The `/d/:token` page calls `driver-login`. The function validates the hash, then calls `auth.admin.generateLink({ type: 'magiclink', email })` and returns `hashed_token`.
4. The client calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` and receives a normal session. The raw token is removed from the URL with `history.replaceState`.
5. The session refreshes normally. The access token hook denies driver claims after `expires_at`; the driver page also checks the event end and signs out.

### 5.3 JWT claims (custom access token hook)

`public.custom_access_token_hook(event jsonb)` adds to `claims`:

| Claim | Staff | Driver |
|---|---|---|
| `app_role` | `admin` / `gate_volunteer` / `zone_volunteer` | `driver` |
| `zone_ids` | array (zone volunteers) | not set |
| `gate_ids` | array (gate volunteers) | not set |
| `driver_id` | not set | uuid |
| `event_id` | not set | uuid |

If the profile is inactive, the hook sets `app_role` to `none`. RLS treats `none` as no access. Role or zone changes take effect on the next token refresh (at most 1 hour). `admin-staff` also calls `auth.admin.signOut(user_id)` on deactivate so it applies immediately.

Enable in `supabase/config.toml`:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

## 6. Realtime model

| Channel | Type | Who subscribes | Payload |
|---|---|---|---|
| `db-visits` filtered `event_id=eq.<id>` | postgres_changes on `visits` | Admin dashboard, gate vehicles list | Row (RLS applies) |
| `db-visits` filtered `id=eq.<visit_id>` | postgres_changes | Driver page | Own visit row |
| `db-visits-zone` filtered `zone_id=eq.<zone>` (one per zone) | postgres_changes | Zone volunteer | Rows in zone |
| `db-slots` filtered `event_id=eq.<id>` | postgres_changes on `slots` | Admin, gate map picker, zone map | Row |
| `db-alerts` filtered `event_id=eq.<id>` | postgres_changes on `alerts` | Admin, zone (client filters by zone) | Row |
| `db-wa` filtered `visit_id=eq.<id>` | postgres_changes on `whatsapp_messages` | Gate done screen | Row |
| `event:<event_id>:positions` | broadcast, private | Driver sends, admin receives | `{visit_id, lat, lng, acc, hdg, spd, t}` |

Tables added to the `supabase_realtime` publication: `visits`, `slots`, `alerts`, `whatsapp_messages`. Broadcast authorisation uses RLS on `realtime.messages` (see `docs/03-DATABASE.md` section 9).

## 7. Client data flow rules

- Map data (`get_event_map` RPC) is fetched once per page with `staleTime: Infinity` and invalidated only when the admin saves in the editor (admin broadcasts `map-updated` on `event:<id>:positions` channel topic `map`; clients refetch).
- Slot statuses are fetched with `get_slot_statuses` and kept fresh through the `db-slots` subscription. Realtime handlers update the TanStack Query cache with `setQueryData`; they never trigger full refetches unless the payload is missing.
- On reconnect (`CHANNEL_ERROR` then `SUBSCRIBED`), invalidate the affected queries once.

## 8. Environment variables

### Frontend (`.env`, prefixed `VITE_`)

| Name | Example | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xyz.supabase.co` | yes |
| `VITE_SUPABASE_ANON_KEY` | publishable/anon key | yes |
| `VITE_APP_URL` | `https://park.example.org` | yes |
| `VITE_MAP_STREET_STYLE` | `https://tiles.openfreemap.org/styles/liberty` | yes |
| `VITE_MAPTILER_KEY` | key | no (satellite hidden if missing) |

### Edge Function secrets (`supabase secrets set`)

| Name | Use |
|---|---|
| `APP_URL` | Build driver links |
| `GEMINI_API_KEY` | Gemini |
| `GEMINI_MODEL` | Default `gemini-2.5-flash`. Change without redeploying code |
| `WHATSAPP_TOKEN` | Permanent system user token |
| `WHATSAPP_PHONE_NUMBER_ID` | Sender number ID |
| `WHATSAPP_APP_SECRET` | Webhook signature check |
| `WHATSAPP_VERIFY_TOKEN` | Webhook GET handshake |
| `WHATSAPP_API_VERSION` | Graph API version, for example `v23.0` |
| `DRIVER_EMAIL_DOMAIN` | `drivers.eventpark.local` |
| `STAFF_EMAIL_DOMAIN` | `staff.eventpark.local` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 9. Error model

Every Edge Function and RPC error returns a stable code. The client maps codes to i18n keys `errors.<code>`.

```json
{ "error": { "code": "SLOT_TAKEN", "message": "Slot is no longer available" } }
```

RPCs raise with `raise exception using errcode = 'P0001', message = 'SLOT_TAKEN'`; the client reads `error.message` as the code. Full code list in `docs/04-BACKEND-SERVICES.md` section 1.

## 10. PWA

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Precache app shell only. Do not cache map tiles or API calls.
- Manifest: name from `APP_NAME`, `display: standalone`, `theme_color` = `--color-surface`, start URL `/`.
- Staff screens show an "Install app" button in the account menu when `beforeinstallprompt` fires.

## 11. Routing and guards

`RoleGuard` reads `app_role` from the session JWT.

| Path prefix | Allowed roles | Else redirect |
|---|---|---|
| `/driver` | driver | `/driver/login` |
| `/gate` | gate_volunteer, admin | `/login` |
| `/zone` | zone_volunteer, admin | `/login` |
| `/admin` | admin | `/login` |

`/` redirects by role: admin to `/admin`, gate to `/gate`, zone to `/zone`, driver to `/driver`, none to `/login`.
