# 03. Database

Postgres 15 with PostGIS on Supabase. All geometry is SRID 4326 (lng/lat). Distances are computed with `::geography` so results are in metres.

## 1. Migration order

Create each file with `supabase migration new <name>`. The CLI prefixes a timestamp. Keep this order and these names.

| # | Name | Contents |
|---|---|---|
| 1 | `extensions` | postgis, pgcrypto, pg_cron, pg_net |
| 2 | `enums` | all enum types (section 2) |
| 3 | `events_profiles` | `events`, `profiles` |
| 4 | `map_tables` | `gates`, `zones`, `slots`, `road_nodes`, `road_segments`, `landmarks`, `map_overlays` |
| 5 | `drivers_visits` | `drivers`, `driver_access_tokens`, `visits`, `visit_events`, `vehicle_positions` |
| 6 | `alerts_messages` | `alerts`, `whatsapp_messages`, `assistant_messages`, `rate_limits` |
| 7 | `helpers_and_hook` | helper functions (section 6), `custom_access_token_hook`, grants |
| 8 | `rls_policies` | all policies (section 8) |
| 9 | `rpc_map` | map RPCs |
| 10 | `rpc_visits` | visit and gate RPCs |
| 11 | `rpc_alerts_dashboard` | alert and dashboard RPCs |
| 12 | `rpc_reports` | report RPCs |
| 13 | `realtime_storage` | publication, realtime.messages policies, storage buckets and policies |
| 14 | `cron_jobs` | `run_maintenance()` and schedules |

RLS must be enabled in migrations 3 to 6 on every table they create (`alter table x enable row level security;`). Policies are added in migration 8.

## 2. Enums

```sql
create type app_role as enum ('admin','gate_volunteer','zone_volunteer','driver');
create type event_status as enum ('draft','live','closed');
create type vehicle_type as enum ('bike','car','ev','bus','other');
create type visitor_category as enum ('vip','guest','faculty','student','staff','volunteer','performer','general');
create type slot_status as enum ('available','assigned','occupied','blocked');
create type visit_status as enum ('assigned','en_route','driver_parked','confirmed','exited','cancelled');
create type gate_kind as enum ('entry','exit','both');
create type road_direction as enum ('two_way','one_way');
create type landmark_kind as enum ('venue','entrance','help_desk','first_aid','toilet','food','other');
create type alert_type as enum ('sos','wrong_slot','location_mismatch','wrong_parking','not_arrived','confirm_pending','overstay');
create type alert_status as enum ('open','acknowledged','resolved');
create type sos_reason as enum ('medical','breakdown','safety','lost','other');
create type payment_method as enum ('free','cash','upi');
create type wa_status as enum ('queued','sent','delivered','read','failed');
create type visit_event_type as enum (
  'checked_in','assigned','link_sent','link_opened','navigation_started',
  'driver_parked','confirmed','wrong_slot_corrected','reassigned',
  'exited','cancelled','location_mismatch','sos'
);
```

`other` vehicle type is routed like `car` for slot matching unless a zone explicitly allows `other`.

## 3. Tables: events and people

### `events`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| name | text not null | |
| venue_name | text | |
| starts_at | timestamptz not null | |
| ends_at | timestamptz not null | check `ends_at > starts_at` |
| timezone | text not null default 'Asia/Kolkata' | |
| status | event_status not null default 'draft' | |
| center | geometry(Point,4326) | initial map center |
| default_zoom | numeric not null default 17 | |
| paid_parking | boolean not null default false | |
| fee_rules | jsonb not null default '{"bike":0,"car":0,"ev":0,"bus":0,"other":0}' | amount in INR per vehicle type |
| fee_exempt_categories | visitor_category[] not null default '{vip,faculty,staff,volunteer,performer}' | |
| emergency_phone | text | E.164 |
| admin_alert_phones | text[] not null default '{}' | E.164, receive SOS on WhatsApp |
| default_language | text not null default 'en' | 'en' or 'ml' |
| arrival_timeout_min | int not null default 20 | not_arrived alert |
| confirm_timeout_min | int not null default 10 | confirm_pending alert |
| overstay_after_end_min | int not null default 60 | overstay alert |
| location_tolerance_m | int not null default 40 | location_mismatch |
| arrival_radius_m | int not null default 20 | driver "You have arrived" |
| base_map | text not null default 'satellite' | 'satellite' or 'street' |
| created_at, updated_at | timestamptz default now() | trigger updates `updated_at` |

Constraint: `create unique index one_live_event on events ((status)) where status = 'live';`

### `profiles` (staff only)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk references auth.users on delete cascade | |
| role | app_role not null | check `role <> 'driver'` |
| full_name | text not null | |
| username | citext unique not null | lowercase, `^[a-z0-9_.]{3,32}$` |
| phone | text | E.164 |
| zone_ids | uuid[] not null default '{}' | for zone volunteers |
| gate_ids | uuid[] not null default '{}' | for gate volunteers; empty = any gate |
| preferred_language | text not null default 'en' | |
| is_active | boolean not null default true | |
| last_seen_at | timestamptz | updated by `touch_last_seen()` RPC on app open |
| created_at, updated_at | timestamptz | |

Requires `create extension citext` (add to migration 1).

### `drivers`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| auth_user_id | uuid unique references auth.users on delete set null | |
| event_id | uuid not null references events | |
| phone_e164 | text not null | `+91XXXXXXXXXX` |
| name | text | |
| preferred_language | text not null default 'en' | |
| location_consent_at | timestamptz | set by `driver_accept_location_consent()` |
| created_at | timestamptz | |

Unique: `(event_id, phone_e164)`.

### `driver_access_tokens`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| driver_id | uuid not null references drivers on delete cascade | |
| token_hash | text unique not null | hex sha256 of raw token |
| expires_at | timestamptz not null | |
| revoked_at | timestamptz | |
| last_used_at | timestamptz | |
| use_count | int not null default 0 | |
| created_at | timestamptz | |

No client access at all (no policies). Service role only.

## 4. Tables: map

### `gates`

id uuid pk, event_id uuid fk, name text not null, name_ml text, kind gate_kind not null default 'both', location geometry(Point,4326) not null, is_active boolean default true, sort_order int default 0, created_at, updated_at.

### `zones`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid not null fk | |
| code | text not null | short, shown on slot labels, `^[A-Z0-9]{1,4}$` |
| name | text not null | |
| name_ml | text | |
| color | text not null | one of zone palette token names `zone-1`..`zone-8` |
| area | geometry(Polygon,4326) not null | |
| vehicle_types | vehicle_type[] not null default '{car}' | |
| categories | visitor_category[] not null default '{}' | empty = all categories |
| is_overflow | boolean not null default false | used only when non-overflow zones have no match |
| priority | int not null default 100 | lower = preferred |
| notes | text | |
| sort_order | int default 0 | |
| created_at, updated_at | | |

Unique `(event_id, code)`. GiST index on `area`.

### `slots`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid not null fk | denormalised for filters and realtime |
| zone_id | uuid not null fk on delete restrict | |
| label | text not null | `<zone.code>-<number padded 3>`, e.g. `A-012` |
| number | int not null | |
| shape | geometry(Polygon,4326) not null | |
| center | geometry(Point,4326) generated always as (ST_Centroid(shape)) stored | |
| vehicle_type | vehicle_type not null | |
| is_accessible | boolean not null default false | |
| has_ev_charger | boolean not null default false | |
| status | slot_status not null default 'available' | |
| blocked_reason | text | required when status = blocked |
| current_visit_id | uuid references visits on delete set null | set by RPCs only (added after `visits` exists, migration 5) |
| status_changed_at | timestamptz default now() | |
| created_at, updated_at | | |

Unique `(zone_id, number)`, unique `(event_id, label)`. Indexes: `(event_id, status, vehicle_type)`, GiST `shape`, GiST `center`.

Check: `(status = 'blocked') = (blocked_reason is not null)`.

### `road_nodes`

id uuid pk, event_id fk, location geometry(Point,4326) not null. GiST index.

### `road_segments`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid fk | |
| from_node | uuid not null fk road_nodes on delete cascade | |
| to_node | uuid not null fk road_nodes on delete cascade | |
| path | geometry(LineString,4326) not null | first coordinate = from_node, last = to_node |
| direction | road_direction not null default 'two_way' | one_way means travel only from_node to to_node |
| name | text | shown in directions, optional |
| length_m | numeric generated always as (ST_Length(path::geography)) stored | |
| is_walk_only | boolean not null default false | footpaths, used only for find my vehicle |

### `landmarks`

id uuid pk, event_id fk, name text not null, name_ml text, kind landmark_kind not null, location geometry(Point,4326) not null.

### `map_overlays`

id uuid pk, event_id fk, storage_path text not null (bucket `map-overlays`), corners jsonb not null (`[[lng,lat] x4]` in order top-left, top-right, bottom-right, bottom-left), opacity numeric default 0.85, is_visible boolean default true.

## 5. Tables: visits and activity

### `visits`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid not null fk | |
| driver_id | uuid not null fk drivers | |
| plate_raw | text not null | as entered |
| plate | text not null | normalised: uppercase, A-Z0-9 only |
| vehicle_type | vehicle_type not null | |
| vehicle_color | text | |
| vehicle_make | text | |
| category | visitor_category not null default 'general' | |
| pass_number | text | |
| pass_holder_name | text | |
| needs_accessible | boolean not null default false | |
| photo_path | text | bucket `vehicle-photos` |
| ai_result | jsonb | raw Gemini output |
| ai_plate_confidence | numeric | 0..1 |
| ai_edited | boolean not null default false | true if volunteer changed plate or type |
| entry_gate_id | uuid fk gates on delete set null | |
| checked_in_by | uuid fk profiles | |
| checked_in_at | timestamptz not null default now() | |
| zone_id | uuid fk zones | current |
| slot_id | uuid fk slots | current |
| status | visit_status not null default 'assigned' | |
| assigned_at | timestamptz not null default now() | updated on reassign |
| link_opened_at | timestamptz | first open |
| navigation_started_at | timestamptz | |
| driver_parked_at | timestamptz | |
| driver_parked_location | geometry(Point,4326) | |
| driver_parked_distance_m | numeric | distance to slot shape |
| confirmed_at | timestamptz | |
| confirmed_by | uuid fk profiles | |
| exited_at | timestamptz | |
| exited_by | uuid fk profiles | |
| exit_gate_id | uuid fk gates on delete set null | |
| cancelled_at | timestamptz | |
| cancel_reason | text | |
| checkin_duration_ms | int | measured by gate client, for reports |
| fee_amount | numeric(10,2) not null default 0 | |
| payment_method | payment_method not null default 'free' | |
| last_position | geometry(Point,4326) | latest persisted |
| last_position_at | timestamptz | |
| created_at, updated_at | | |

Indexes:

```sql
create unique index visits_one_active_plate on visits (event_id, plate)
  where status in ('assigned','en_route','driver_parked','confirmed');
create unique index visits_one_active_slot on visits (slot_id)
  where status in ('assigned','en_route','driver_parked','confirmed');
create index visits_event_status on visits (event_id, status);
create index visits_zone_status on visits (zone_id, status);
create index visits_driver on visits (driver_id);
create index visits_plate_trgm on visits using gin (plate gin_trgm_ops);  -- needs pg_trgm (migration 1)
```

"Active" statuses everywhere in the code: `assigned, en_route, driver_parked, confirmed`. Define once in SQL as `is_active_status(visit_status)` and in TS as `ACTIVE_VISIT_STATUSES`.

### `visit_events` (audit)

id bigint identity pk, visit_id uuid fk on delete cascade, event_id uuid, type visit_event_type not null, actor_role app_role, actor_id uuid, data jsonb not null default '{}', created_at timestamptz default now(). Index `(visit_id, created_at)`.

Written only inside RPCs and Edge Functions.

### `vehicle_positions`

id bigint identity pk, visit_id uuid fk on delete cascade, event_id uuid, location geometry(Point,4326), accuracy_m numeric, heading numeric, speed_mps numeric, recorded_at timestamptz not null. Index `(visit_id, recorded_at desc)`, `(event_id, recorded_at desc)`.

Inserted by `record_position()` at most once every 15 s per visit (enforced in the RPC).

## 6. Tables: alerts, messages, assistant

### `alerts`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| event_id | uuid not null fk | |
| type | alert_type not null | |
| status | alert_status not null default 'open' | |
| visit_id | uuid fk | |
| slot_id | uuid fk | |
| zone_id | uuid fk | for zone volunteer visibility |
| sos_reason | sos_reason | for type sos |
| message | text | free text from reporter |
| location | geometry(Point,4326) | |
| photo_path | text | bucket `alert-photos` |
| raised_by_profile | uuid fk profiles | |
| raised_by_driver | uuid fk drivers | |
| raised_by_system | boolean not null default false | |
| acknowledged_by, acknowledged_at | | |
| resolved_by, resolved_at, resolution_note | | |
| dedupe_key | text | unique where status <> 'resolved' |
| created_at | | |

`dedupe_key` examples: `not_arrived:<visit_id>`, `confirm_pending:<visit_id>`, `overstay:<visit_id>`, `location_mismatch:<visit_id>`. System alerts use `insert ... on conflict do nothing`.

### `whatsapp_messages`

id uuid pk, event_id, driver_id, visit_id, template text, language text, to_phone text, wa_message_id text unique, status wa_status default 'queued', error_code text, error_title text, payload jsonb, created_at, updated_at.

### `assistant_messages`

id bigint identity pk, admin_id uuid fk profiles, session_id uuid not null, role text check in ('user','assistant','tool'), content text, tool_calls jsonb, created_at.

### `rate_limits`

key text pk, window_start timestamptz, count int. Used by `_shared/rateLimit.ts` through RPC `hit_rate_limit(key, max, window_seconds) returns boolean`.

## 7. Helper functions (migration 7)

All `stable`, `security definer`, `set search_path = public`.

```sql
current_app_role() returns text        -- auth.jwt()->>'app_role', default 'none'
is_admin() returns boolean
is_staff() returns boolean             -- admin, gate_volunteer, zone_volunteer
current_driver_id() returns uuid       -- (auth.jwt()->>'driver_id')::uuid
current_zone_ids() returns uuid[]      -- from profiles.zone_ids for auth.uid()
live_event_id() returns uuid           -- id of the event with status 'live'
is_active_status(s visit_status) returns boolean
normalize_plate(t text) returns text   -- upper(regexp_replace(t,'[^A-Za-z0-9]','','g'))
log_visit_event(visit uuid, type visit_event_type, data jsonb) returns void
set_updated_at() trigger
```

`current_zone_ids()` reads from `profiles` (not the JWT) so zone changes apply immediately.

### Custom access token hook

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  uid uuid := (event->>'user_id')::uuid;
  claims jsonb := event->'claims';
  p record; d record; t record;
begin
  select role, zone_ids, gate_ids, is_active into p from public.profiles where id = uid;
  if found then
    claims := claims || jsonb_build_object(
      'app_role', case when p.is_active then p.role::text else 'none' end,
      'zone_ids', to_jsonb(p.zone_ids), 'gate_ids', to_jsonb(p.gate_ids));
  else
    select dr.id, dr.event_id into d from public.drivers dr where dr.auth_user_id = uid;
    if found then
      select 1 into t from public.driver_access_tokens
        where driver_id = d.id and revoked_at is null and expires_at > now() limit 1;
      claims := claims || jsonb_build_object(
        'app_role', case when found then 'driver' else 'none' end,
        'driver_id', d.id, 'event_id', d.event_id);
    else
      claims := claims || '{"app_role":"none"}';
    end if;
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on public.profiles, public.drivers, public.driver_access_tokens to supabase_auth_admin;
```

Add RLS policies `for select to supabase_auth_admin using (true)` on those three tables.

## 8. RLS policies (migration 8)

Principle: clients get `select` through policies. Almost all writes go through `security definer` RPCs that check the role themselves. The only direct client writes are none; even the admin map editor writes through RPCs.

| Table | admin | gate_volunteer | zone_volunteer | driver | anon |
|---|---|---|---|---|---|
| events | select all | select | select | select own event_id | none |
| profiles | select all | select own row | select own row | none | none |
| gates, zones, slots, road_nodes, road_segments, landmarks, map_overlays | select | select | select | select where event_id = jwt event_id | none |
| drivers | select | select | none | select own row | none |
| driver_access_tokens | none | none | none | none | none |
| visits | select | select | select where zone_id = any(current_zone_ids()) | select where driver_id = current_driver_id() | none |
| visit_events | select | select | select where visit in own zones | none | none |
| vehicle_positions | select | none | none | none | none |
| alerts | select | select type in (sos, wrong_parking) | select where zone_id = any(current_zone_ids()) | select own raised | none |
| whatsapp_messages | select | select | none | none | none |
| assistant_messages | select own admin_id | none | none | none | none |

Zone volunteers cannot read `drivers`. They see only a masked phone (`+91 98xxxxxx21`) returned by `get_zone_visits()`.

Example policies:

```sql
create policy visits_admin_gate_select on visits for select to authenticated
  using (current_app_role() in ('admin','gate_volunteer'));
create policy visits_zone_select on visits for select to authenticated
  using (current_app_role() = 'zone_volunteer' and zone_id = any(current_zone_ids()));
create policy visits_driver_select on visits for select to authenticated
  using (current_app_role() = 'driver' and driver_id = current_driver_id());

create policy slots_staff_select on slots for select to authenticated
  using (is_staff());
create policy slots_driver_select on slots for select to authenticated
  using (current_app_role() = 'driver' and event_id = (auth.jwt()->>'event_id')::uuid);
```

Use the same pattern for every map table.

## 9. Realtime and Storage (migration 13)

```sql
alter publication supabase_realtime add table visits, slots, alerts, whatsapp_messages;
alter table visits replica identity full;   -- so zone filters work on UPDATE when zone changes
```

Broadcast authorisation on private channel topics `event:<uuid>:positions`:

```sql
create policy rt_positions_read on realtime.messages for select to authenticated
  using (realtime.topic() like 'event:%:positions' and current_app_role() = 'admin');
create policy rt_positions_write on realtime.messages for insert to authenticated
  using (true) with check (
    realtime.topic() = 'event:' || (auth.jwt()->>'event_id') || ':positions'
    and current_app_role() = 'driver'
  );
create policy rt_map_updates_read on realtime.messages for select to authenticated
  using (realtime.topic() like 'event:%:map');
create policy rt_map_updates_write on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'event:%:map' and current_app_role() = 'admin');
```

Storage buckets (all private):

| Bucket | Path pattern | Insert | Select |
|---|---|---|---|
| `vehicle-photos` | `<event_id>/<yyyy-mm-dd>/<uuid>.jpg` | gate_volunteer, admin | admin, gate, zone (signed URL only) |
| `alert-photos` | `<event_id>/<uuid>.jpg` | zone_volunteer, admin | admin, zone |
| `map-overlays` | `<event_id>/<uuid>.<ext>` | admin | all authenticated of that event |

Max file size 5 MB, MIME `image/jpeg, image/png, image/webp`.

## 10. Cron (migration 14)

```sql
select cron.schedule('eventpark-maintenance', '* * * * *', $$select public.run_maintenance()$$);
select cron.schedule('eventpark-retention', '30 3 * * *', $$select public.run_retention()$$);
```

`run_maintenance()` logic is in `docs/04-BACKEND-SERVICES.md` section 6. `run_retention()` deletes `vehicle_positions` for events closed more than 7 days ago, deletes storage objects in `vehicle-photos` and `alert-photos` for events closed more than 30 days ago (via `storage.objects` delete, which Supabase allows from SQL for the service role), and deletes `rate_limits` rows older than 1 day.

## 11. Seed (`supabase/seed.sql`, local only)

1. Admin user: username `admin`, password `admin12345`, via `auth.users` insert with `crypt()` and matching `auth.identities` row, plus `profiles` row.
2. One gate volunteer `gate1`, one zone volunteer `zoneA` (both password `test12345`).
3. One event "Demo Fest" live, centered on a sample campus, 3 zones (A cars, B bikes, C VIP cars), 60 slots, 2 gates, a small road network including one one-way loop, 3 landmarks.
4. No visits.
