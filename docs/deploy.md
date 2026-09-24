# 11. Setup, Deploy, QA

## 1. Local setup

Requirements: Node 22 LTS, pnpm 9+, Docker, Supabase CLI (installed as dev dependency, run with `pnpm supabase`), a MapTiler key (optional), a Gemini API key, a WhatsApp test number (Meta gives a test number with 5 allowed recipients).

```bash
pnpm create vite@latest eventpark -- --template react-ts
cd eventpark
pnpm add <runtime packages from 02-ARCHITECTURE.md section 3>
pnpm add -D <dev packages>
pnpm dlx shadcn@latest init           # style: new-york, base color: neutral, css variables: yes
pnpm dlx shadcn@latest add button input textarea select dialog sheet drawer tabs popover command table \
  badge switch toggle-group tooltip dropdown-menu skeleton scroll-area separator alert progress checkbox radio-group label sonner
pnpm supabase init
pnpm supabase start
```

After `shadcn init`, replace the generated CSS variables with the tokens in `06-DESIGN-SYSTEM.md` section 2 and map shadcn's variable names (`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--radius`) to them in `theme.css`.

`.env.example`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
VITE_APP_URL=http://localhost:5173
VITE_MAP_STREET_STYLE=https://tiles.openfreemap.org/styles/liberty
VITE_MAPTILER_KEY=
```

Edge Function secrets locally in `supabase/functions/.env` (git-ignored), same names as `02-ARCHITECTURE.md` section 8.

`supabase/config.toml` additions:

```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173"]
enable_signup = false            # staff and drivers are created by functions only
jwt_expiry = 3600

[auth.email]
enable_signup = false
enable_confirmations = false

[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"

[functions.driver-login]
verify_jwt = false
[functions.driver-resend-link]
verify_jwt = false
[functions.whatsapp-webhook]
verify_jwt = false
[functions.alert-dispatch]
verify_jwt = false
```

Local webhook testing for WhatsApp: expose `supabase functions serve` with a tunnel (for example `cloudflared tunnel --url http://127.0.0.1:54321`) and set that URL in the Meta dashboard.

## 2. Supabase CLI workflow

```bash
pnpm supabase migration new rpc_visits        # creates supabase/migrations/<timestamp>_rpc_visits.sql
pnpm supabase db reset                        # re-applies all migrations + seed locally
pnpm supabase test db                         # runs pgTAP tests in supabase/tests
pnpm supabase gen types typescript --local > src/types/database.ts
pnpm supabase db diff -f <name>               # only to inspect; hand-write migrations, do not rely on diff output blindly
```

Rules:
- One concern per migration. Functions use `create or replace`, so later migrations can redefine a function without editing the old file.
- Never edit an applied migration. Fix forward with a new one.
- Every migration must run on an empty database via `db reset` in CI.

## 3. Production deploy

1. Create a Supabase project in the Mumbai region (`ap-south-1`).
2. Enable extensions from the dashboard if `create extension` needs it: PostGIS, pg_cron, pg_net, pg_trgm, citext.
3. `pnpm supabase link --project-ref <ref>` then `pnpm supabase db push`.
4. Auth settings in the dashboard: disable signups, enable the custom access token hook, set Site URL to `APP_URL`.
5. `pnpm supabase secrets set --env-file ./supabase/functions/.env.production`.
6. `pnpm supabase functions deploy` (all functions).
7. Create the database webhook `sos_dispatch` (see `04-BACKEND-SERVICES.md` section 9).
8. Create the first admin: run `scripts/create-admin.ts` locally with the service role key: `pnpm tsx scripts/create-admin.ts --username admin --name "Admin" --password '<strong>'`. The script calls `auth.admin.createUser` and inserts the profile.
9. Frontend: deploy the Vite build to Vercel, Netlify, or Cloudflare Pages. Build command `pnpm build`, output `dist`. SPA fallback: all routes to `index.html`. Set `VITE_*` variables in the host.
10. Custom domain with HTTPS (required for geolocation, camera, wake lock, PWA).
11. WhatsApp: set the production webhook URL; submit templates; add the production number.

## 4. Event preparation checklist (admin)

One week before:
- [ ] Event created with correct times.
- [ ] WhatsApp templates approved in `en` and `ml`.
- [ ] Map drawn: zones, slots, roads with one-way directions, gates, landmarks. Warnings list is empty.
- [ ] Walk the campus with a phone on the driver page (test visit) and check directions at every junction.
- [ ] Staff accounts created; zones and gates assigned; each volunteer logged in once on their own phone and installed the PWA.
- [ ] Settings: fees, timeouts, emergency phone, admin SOS phones. Send a test WhatsApp.

Day before:
- [ ] Set the event live. Run 5 test check-ins end to end, then cancel them.
- [ ] Print the fallback sheet for gates: QR code link to `/driver/login` and the help line number.

Event day, per gate: phone charged, power bank, mobile data on, app logged in, gate selected.

## 5. Tests

### 5.1 Unit (vitest, `tests/unit`)

| File | Must cover |
|---|---|
| `plate.test.ts` | normalise (spaces, dashes, lowercase), valid standard, valid BH, invalid samples |
| `phone.test.ts` | 10 digits, with +91, with 0 prefix, spaces, invalid first digit |
| `slotGenerator.test.ts` | 90° and 45°, left and right, fit to line count, no overlap between neighbours, slot dimensions within 2 cm |
| `roadGraph.test.ts` | split at crossing, endpoint snapping within 1.5 m, stable node ids, drop < 1 m pieces |
| `routing.test.ts` | shortest path, one-way respected (route goes around), walk mode ignores one-way, no path returns null, off-campus returns null |
| `instructions.test.ts` | left/right/slight/sharp/uturn classification, merge straights, arrival side |
| `format.test.ts` | distance rounding, plate formatting, relative time |

### 5.2 Database (pgTAP, `supabase/tests`)

| Test | Checks |
|---|---|
| `rls.test.sql` | each role sees exactly the rows in `03-DATABASE.md` section 8; anon sees nothing; driver cannot read another driver's visit |
| `assign.test.sql` | assign succeeds; second assign to same slot → SLOT_TAKEN; blocked slot → SLOT_BLOCKED; duplicate plate → PLATE_ACTIVE |
| `transitions.test.sql` | every allowed transition in `04` section 2 works; every other raises INVALID_STATE; slot status follows |
| `wrong_slot.test.sql` | old slot freed, new occupied, alert created |
| `mark_parked.test.sql` | mismatch alert when far, none when near, null location allowed |
| `suggest.test.sql` | type filter, category filter, overflow fallback, accessible preference, distance order |
| `maintenance.test.sql` | not_arrived and confirm_pending alerts created once and auto-resolved |
| `reports.test.sql` | occupancy bucket counts on a fixed dataset, peak buckets, revenue sums |
| `editor.test.sql` | slot outside zone rejected, overlap rejected, delete with active visit rejected, zone code change relabels slots |

### 5.3 Edge functions (Deno test, `supabase/functions/<name>/index.test.ts`)

Mock WhatsApp and Gemini with a local fetch stub. Cover: role checks, input validation, happy path, WhatsApp failure still returns link, driver-login invalid/expired/revoked, resend-link generic response, webhook signature rejection, status never moves backwards.

### 5.4 End to end (Playwright, `tests/e2e`)

Run against local Supabase with seed data and stubbed external APIs (functions read `E2E_STUB=1`).

1. `gate-checkin.spec.ts`: gate volunteer logs in, uploads fixture photo, edits plate, enters phone, accepts recommended slot, sees done screen with QR.
2. `driver-flow.spec.ts`: open `/d/<token>` from the check-in, grant geolocation (Playwright `context.grantPermissions` + `setGeolocation`), start directions, move along the route with 5 geolocation updates, arrival sheet appears, mark as parked.
3. `zone-confirm.spec.ts`: zone volunteer sees the vehicle in Waiting, confirms; driver page switches to Find my vehicle.
4. `wrong-slot.spec.ts`: zone volunteer picks another slot; admin alert appears.
5. `sos.spec.ts`: driver sends SOS; admin dashboard shows it pinned.
6. `editor.spec.ts`: admin draws a zone, generates a row of 10 slots, saves; slots appear in the zones table.
7. `reports.spec.ts`: seeded visits produce expected numbers; Excel file downloads.

Viewports: 360 × 740 for driver, gate, zone; 1280 × 800 for admin.

### 5.5 Manual field test (before every event)

- Real phones: one cheap Android, one iPhone. Check GPS accuracy on campus, sunlight readability, camera capture, WhatsApp link opening from the WhatsApp in-app browser and from Chrome/Safari.
- Drive every route once with navigation on.

## 6. Event-day runbook

| Problem | Action |
|---|---|
| WhatsApp failing for everyone | Gates use QR codes on the done screen. Admin checks Settings > WhatsApp test and the Meta dashboard for template or token issues |
| Gemini slow or down | Volunteers use "Enter details manually". No action needed server-side |
| A zone is full | Nothing to do. Suggestions move to the next matching zone. To open an extra ground, the admin draws it as a zone with the overflow switch on |
| Driver says link doesn't open | Ask them to open `/driver/login` (printed QR at gate) and request the link again, or scan the QR from the gate device |
| Volunteer phone dies | Admin moves their zone to another volunteer in Staff; the new volunteer sees the list immediately |
| Road closed during event | Admin edits the road in the map editor (delete segment or make it one-way) and saves roads; drivers' routes update on next reroute |
| Wrong vehicle marked exit | Admin can't undo exit. Check the vehicle in again at a gate with the same phone; the link is reissued |
| Internet at gate drops | Offline banner shows. Hold vehicles for a moment or use a second gate phone on a different network |

## 7. Monitoring

- Supabase dashboard: database CPU, realtime connections, function errors.
- Admin dashboard WhatsApp failed count and alerts count.
- Edge Functions log a single JSON line per request: `{fn, role, ms, status, code}`. No phone numbers, tokens, or plates in logs.