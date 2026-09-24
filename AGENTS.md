# AGENTS.md

Instructions for any AI coding agent or developer working in this repository. Follow them exactly. When something is not covered, stop and ask instead of inventing behaviour.

## 1. Before you write code

1. Read `README.md`, then `docs/01-PRD.md` through `docs/12-BUILD-PLAN.md` in order.
2. Find the feature ID (for example `F-GATE-03`) you are implementing in `docs/01-PRD.md`. Every PR and commit references at least one feature ID or task ID from `docs/12-BUILD-PLAN.md`.
3. Find the screen in `docs/07-UI-PAGES.md` and the backend contract in `docs/04-BACKEND-SERVICES.md`. Build exactly what they describe.

## 2. Hard rules

### Scope
- Do not add features, screens, settings, fields, or copy that are not in the docs. No "nice to have" extras.
- Do not rename routes, tables, columns, enums, RPCs, Edge Functions, or i18n keys defined in the docs.
- If the docs are ambiguous, check `docs/01-PRD.md` section "Decisions already made". If still unclear, leave a `// TODO(docs): <question>` and ask.

### Stack
- Only the libraries listed in `docs/02-ARCHITECTURE.md` section 3. Adding a dependency requires updating that list in the same PR with a one-line reason.
- No Next.js, no Redux, no Axios, no Moment, no Leaflet, no Google Maps JS SDK, no Mapbox GL (use MapLibre), no CSS-in-JS, no styled-components.
- TypeScript `strict: true`. No `any`. No `@ts-ignore`. Use `unknown` plus a zod parse at boundaries.

### Data and security
- Database changes happen only through new migration files created with `supabase migration new <name>`. Never edit a migration that has been applied to any shared environment.
- Every table has RLS enabled in the same migration that creates it.
- The browser never writes directly to `visits`, `slots` status, `alerts` status, `drivers`, `driver_access_tokens`, or `whatsapp_messages`. All mutations go through the RPCs or Edge Functions in `docs/04-BACKEND-SERVICES.md`.
- The Supabase service role key, Gemini key, and WhatsApp token exist only in Edge Function secrets. Never in `src/`, never in `VITE_*` variables.
- After any migration, regenerate types: `supabase gen types typescript --local > src/types/database.ts`. Never hand-edit that file.

### UI
- Use only design tokens from `docs/06-DESIGN-SYSTEM.md`. No raw hex values, no arbitrary Tailwind values like `text-[13px]` or `bg-[#123456]`, except inside `src/styles/theme.css` and map style files in `src/features/map/style/`.
- Light theme only in v1. Do not add a dark mode toggle.
- Use shadcn/ui components from `src/components/ui/`. Do not install another component library.
- No gradients, no glassmorphism, no drop shadows beyond the two shadow tokens, no emoji in UI, no decorative icons.
- Copy rules in `docs/06-DESIGN-SYSTEM.md` section 9 are mandatory: sentence case, no middle dots as separators, no ALL CAPS labels, no arrows appended to buttons, no filler text.
- Every user-visible string goes through i18next (`t('key')`) with keys in both `en` and `ml` files. No hardcoded strings in components.

### Code style
- Feature folders under `src/features/<feature>/` as described in `docs/02-ARCHITECTURE.md` section 4.
- Components: PascalCase files, one component per file, named exports. Hooks: `useXxx.ts`. No default exports except route modules if needed by the router.
- Server state with TanStack Query. Local UI state with `useState`. Cross-screen client state (gate wizard, map editor) with the zustand stores defined in the docs only.
- Query keys come from `src/lib/queryKeys.ts`. Do not inline query key arrays.
- Supabase calls live in `src/features/<feature>/api.ts`, never inside components.
- Forms use react-hook-form + zod schemas from `src/lib/schemas/`.
- Dates are stored UTC, displayed in `Asia/Kolkata` using `date-fns-tz`. Use the helpers in `src/lib/format.ts`.

## 3. Commands

```bash
pnpm install
supabase start                      # local stack (Docker)
supabase db reset                   # apply all migrations + seed
supabase gen types typescript --local > src/types/database.ts
supabase functions serve            # run edge functions locally
pnpm dev                            # Vite dev server
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e                       # Playwright
supabase migration new <name>       # new migration file
supabase db push                    # apply to linked remote project
supabase functions deploy <name>
```

Package manager is `pnpm`. Do not commit `package-lock.json` or `yarn.lock`.

## 4. Definition of done

A task is done only when all are true:

1. Behaviour matches the PRD acceptance criteria and the page spec.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` pass.
3. New RPCs or functions have tests listed in `docs/11-SETUP-DEPLOY-QA.md` section 5.
4. All strings exist in `src/locales/en/*.json` and `src/locales/ml/*.json`.
5. Loading, empty, and error states from the page spec are implemented.
6. Works at 360 px width (driver, gate, zone screens) and 1280 px width (admin).
7. No console errors or warnings in the browser.

## 5. Commit and PR format

```
feat(gate): photo capture and AI extraction [F-GATE-01, T-3.2]
fix(zone): confirm button disabled after wrong-slot [F-ZONE-03]
db: add suggest_slots rpc [T-2.4]
```

PR description: what changed, feature IDs, screenshots at 360 px and 1280 px for UI work, migration names if any.

## 6. Things agents commonly get wrong here

- Using `navigator.geolocation.getCurrentPosition` in a loop. Use `watchPosition` through `useLiveLocation` only.
- Writing geometry as GeoJSON straight into PostgREST. PostGIS columns are written only via the `admin_*` RPCs which call `ST_GeomFromGeoJSON`.
- Calling Gemini or WhatsApp from the browser. Both are Edge Function only.
- Treating `driver_parked` as final. Only `confirmed` is final parking; `exited` ends the visit.
- Forgetting that zone volunteers can confirm a vehicle whose driver never tapped "Mark as parked".
- Forgetting the QR fallback on the gate "Done" step when WhatsApp fails.
- Rendering Malayalam in jsPDF. PDF exports are English only (see `docs/09-REPORTS.md`).
