# EventPark

Smart parking for college events. Vehicles are checked in at the gate with an AI photo read, assigned a slot, and guided to it through a WhatsApp link with live navigation. Zone volunteers confirm parking. Admins design the parking map, watch live traffic, and pull reports.

`EventPark` is a working name. Change it in one place: `src/config/app.ts` (`APP_NAME`) and the WhatsApp templates.

## Documentation map

Read in this order. Every file is binding. If two files disagree, the lower number wins and the conflict must be reported.

| # | File | What it decides |
|---|------|-----------------|
| - | `AGENTS.md` | Rules for anyone (human or AI) writing code in this repo |
| 01 | `docs/01-PRD.md` | Scope, roles, full flow, feature list with IDs, acceptance criteria |
| 02 | `docs/02-ARCHITECTURE.md` | Stack, exact libraries, folder structure, auth model, realtime model, env vars |
| 03 | `docs/03-DATABASE.md` | Every enum, table, index, RLS policy, trigger, and migration order |
| 04 | `docs/04-BACKEND-SERVICES.md` | Every RPC and Edge Function: input, output, step-by-step logic, errors |
| 05 | `docs/05-MAPS-AND-NAVIGATION.md` | Map stack, map editor, slot generator, road graph, routing, live tracking, traffic |
| 06 | `docs/06-DESIGN-SYSTEM.md` | Tokens, type, color, components, map styling, copy rules |
| 07 | `docs/07-UI-PAGES.md` | Every route and screen: layout, placement, states, actions |
| 08 | `docs/08-WHATSAPP-AND-AI.md` | WhatsApp templates and webhook, Gemini extraction, admin assistant |
| 09 | `docs/09-REPORTS.md` | Report definitions, SQL logic, charts, Excel and PDF export |
| 10 | `docs/10-I18N.md` | English and Malayalam handling, key structure, core strings |
| 11 | `docs/11-SETUP-DEPLOY-QA.md` | Local setup, Supabase CLI workflow, deploy, test plan, event-day runbook |
| 12 | `docs/12-BUILD-PLAN.md` | Milestones and ordered task checklist |

## Stack at a glance

Vite, React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Supabase (Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions), Supabase CLI migrations, MapLibre GL JS, Terra Draw, Turf.js, WhatsApp Cloud API, Google Gemini API.