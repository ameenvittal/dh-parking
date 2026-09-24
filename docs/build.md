# 12. Build Plan

Build in this order. Each milestone ends with something that can be demoed. Task IDs are used in commits (`[T-3.2]`). Do not start a milestone before the previous one's demo works.

## M0. Foundation

| ID | Task | Output |
|---|---|---|
| T-0.1 | Scaffold Vite + React + TS strict, pnpm, ESLint, Prettier, Vitest, Playwright | `pnpm lint/typecheck/test` pass |
| T-0.2 | Tailwind v4 + `theme.css` tokens + fonts + `globals.css` (`pb-safe`, `:lang(ml)`) | Token preview page at `/dev/tokens` (dev build only) |
| T-0.3 | shadcn init and components list, restyled with tokens | |
| T-0.4 | Common components: PlateChip, SlotLabel, StatusBadge, VehicleCard, EmptyState, OfflineBanner, LanguageSwitch, ConfirmDialog, PageHeader | Shown on `/dev/components` |
| T-0.5 | i18n setup, namespaces, `i18n:check` script, lint rule | |
| T-0.6 | Supabase init, config.toml, migrations 1–3 (extensions, enums, events/profiles), seed admin | `db reset` works |
| T-0.7 | Router, providers, RoleGuard, staff login page, role redirect | Admin can log in |
| T-0.8 | Custom access token hook (migration 7 partial), `useAuth` exposing role and claims | Role visible in JWT |
| T-0.9 | Admin shell (sidebar, top bar, event switcher placeholder) | |
| T-0.10 | PWA plugin, manifest, icons | Installable |

## M1. Map and editor

| ID | Task |
|---|---|
| T-1.1 | Migration 4 (map tables) with RLS enabled; migration 9 (map RPCs); pgTAP editor tests |
| T-1.2 | Events page and dialog, `admin_upsert_event`, `admin_set_event_status` |
| T-1.3 | `BaseMap` with street and satellite, layer definitions, colours file |
| T-1.4 | Editor shell: toolbar, properties panel, status bar, store |
| T-1.5 | Zone draw + properties + save |
| T-1.6 | `slotGenerator.ts` with tests; slot row tool with preview; save |
| T-1.7 | Single slot tool, select/move/rotate, bulk slot properties |
| T-1.8 | Road tool, snapping, direction, arrows; `roadGraph.ts` with tests; save roads |
| T-1.9 | Gates, landmarks, image overlay |
| T-1.10 | Validation and warnings dropdown, unsaved changes guard |
| T-1.11 | Zones and slots page with bulk actions |
| T-1.12 | Seed: demo campus map |

Demo: draw a full campus map and see it in the zones table.

## M2. Core data and gate

| ID | Task |
|---|---|
| T-2.1 | Migrations 5, 6 (drivers, visits, alerts, messages, rate limits) |
| T-2.2 | Migration 8 RLS policies; `rls.test.sql` |
| T-2.3 | Migration 10 visit RPCs: `assign_new_visit`, `reassign_visit`, `find_active_visit_by_plate`, `get_gate_overview`, `search_visits`, `get_visit_detail`, `mark_exit`, `cancel_visit`, `set_visit_fee`, `set_my_language`; pgTAP tests |
| T-2.4 | `suggest_slots` + tests |
| T-2.5 | Storage buckets and policies (migration 13 part) |
| T-2.6 | `_shared` modules (cors, auth, errors, phone, plate, tokens, rateLimit, supabaseAdmin) |
| T-2.7 | `extract-vehicle` with Gemini + stub mode |
| T-2.8 | `whatsapp.ts` + `gate-checkin` + stub mode |
| T-2.9 | Gate home page |
| T-2.10 | Check-in wizard: store, photo step, details step, phone step |
| T-2.11 | Slot step with suggestions, zone chips, map picker, fee row |
| T-2.12 | Done step with WhatsApp realtime status and QR |
| T-2.13 | Exit page, vehicles page, vehicle action sheet, `visit-reassign`, cancel |

Demo: check in a vehicle from a phone and receive a WhatsApp message.

## M3. Driver

| ID | Task |
|---|---|
| T-3.1 | `driver-login`, `driver-resend-link`; driver pages `/d/:token` and `/driver/login` |
| T-3.2 | Driver RPCs: `driver_get_my_visit`, `driver_accept_location_consent`, `driver_start_navigation`, `driver_mark_parked`, `record_position` |
| T-3.3 | Driver home with consent state, map, sheet, status logic, realtime reassign |
| T-3.4 | `useLiveLocation`, `useWakeLock`, position broadcast (realtime policies migration 13) |
| T-3.5 | `routing.ts`, `instructions.ts` with tests |
| T-3.6 | Navigate page: follow camera, instruction card, reroute, arrival sheet |
| T-3.7 | Find my vehicle with walking route and landmark |
| T-3.8 | SOS: `raise_sos`, sheet, `alert-dispatch`, database webhook |
| T-3.9 | `whatsapp-webhook`: statuses and inbound auto-reply |

Demo: full drive from gate to slot on campus with a real phone.

## M4. Zone volunteer

| ID | Task |
|---|---|
| T-4.1 | `get_zone_visits`, `zone_confirm_parked`, `zone_flag_not_here`, `report_wrong_parking`, `update_alert` + tests |
| T-4.2 | Zone page: counters, tabs, cards, realtime, toasts, search |
| T-4.3 | Zone map view |
| T-4.4 | Visit detail with confirm, wrong slot sheet, not here, exit |
| T-4.5 | Report wrong parking sheet with photo |
| T-4.6 | `run_maintenance()` and cron (migration 14) + tests |

Demo: complete flow gate → driver → zone confirm, including wrong slot.

## M5. Admin live operations

| ID | Task |
|---|---|
| T-5.1 | `get_dashboard_summary`, `get_recent_activity`, `get_live_vehicles`, `get_road_traffic` |
| T-5.2 | Dashboard page |
| T-5.3 | Live map page with traffic colouring and popovers |
| T-5.4 | Vehicles table and drawer with actions and trail |
| T-5.5 | Alerts page and drawer, SOS sound |
| T-5.6 | Staff page and `admin-staff` function |
| T-5.7 | Settings page with WhatsApp test |

Demo: admin runs a simulated event with 3 phones.

## M6. Reports and assistant

| ID | Task |
|---|---|
| T-6.1 | Migration 12 report RPCs + `export_visits` + tests |
| T-6.2 | Reports page, four tabs with charts and tables |
| T-6.3 | Excel export |
| T-6.4 | PDF export |
| T-6.5 | `admin-assistant` function with tools |
| T-6.6 | Assistant page |

## M7. Hardening

| ID | Task |
|---|---|
| T-7.1 | Retention job `run_retention()` |
| T-7.2 | Rate limits verified on public functions |
| T-7.3 | Accessibility pass (keyboard, contrast, screen reader labels) |
| T-7.4 | Performance: lazy-load map and admin chunks, driver bundle under 350 KB gzip |
| T-7.5 | Full Playwright suite green, manual field test on campus |
| T-7.6 | Malayalam review by a native speaker; WhatsApp templates submitted |
| T-7.7 | Production deploy per `11-SETUP-DEPLOY-QA.md` section 3 |

## Feature to task map

| Feature | Tasks |
|---|---|
| F-GATE-01..03 | T-2.7, T-2.10 |
| F-GATE-04 | T-2.3, T-2.10 |
| F-GATE-05 | T-2.10 |
| F-GATE-06, 07 | T-2.4, T-2.11 |
| F-GATE-08, 09 | T-2.8, T-2.12 |
| F-GATE-10 | T-2.11, T-2.13 |
| F-GATE-11, 12 | T-2.13 |
| F-DRV-01, 02 | T-3.1 |
| F-DRV-03..07, 10, 12 | T-3.2, T-3.3, T-3.4, T-3.6 |
| F-DRV-05 | T-3.5, T-3.6 |
| F-DRV-08 | T-3.7 |
| F-DRV-09 | T-3.8 |
| F-DRV-11, F-I18N-01 | T-0.5, T-7.6 |
| F-ZONE-01..08 | M4 |
| F-ADM-01, 02 | T-5.1..T-5.3 |
| F-ADM-03 | T-1.2 |
| F-ADM-04 | T-5.4 |
| F-ADM-05, F-ALERT-01 | T-4.6, T-5.5 |
| F-ADM-06 | T-5.6 |
| F-ADM-07 | T-5.7 |
| F-ADM-08 | T-6.5, T-6.6 |
| F-MAP-01..10 | M1 |
| F-RPT-01..05 | M6 |
| F-WA-01 | T-2.8, T-3.1, T-3.9 |
| F-PWA-01 | T-0.10, T-3.4 |
| F-AUDIT-01 | T-2.3 and every RPC |