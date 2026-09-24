# 04. Backend Services

Every server operation the client may call. If it is not in this file, it does not exist.

Conventions:

- RPCs are `language plpgsql security definer set search_path = public`. First line of each: role check. Revoke `execute` from `public, anon`; grant to `authenticated` (or to `service_role` only where marked).
- RPC arguments are prefixed `p_`. Return types are `jsonb` unless stated.
- Errors: `raise exception using errcode = 'P0001', message = '<CODE>';`
- Every state change of a visit calls `log_visit_event()`.
- Coordinates in and out are `[lng, lat]` numbers or GeoJSON. Never WKT from the client.

## 1. Error codes

| Code                 | Meaning                            | Shown to user (en)                              |
| -------------------- | ---------------------------------- | ----------------------------------------------- |
| `FORBIDDEN`          | Role not allowed                   | You don't have access to this                   |
| `NO_LIVE_EVENT`      | No event is live                   | No event is live right now                      |
| `EVENT_CLOSED`       | Event is closed                    | This event has ended                            |
| `NOT_FOUND`          | Row missing                        | Not found                                       |
| `SLOT_TAKEN`         | Slot not available anymore         | That slot was just taken. Pick another          |
| `SLOT_TYPE_MISMATCH` | Slot vehicle type differs          | This slot is for a different vehicle type       |
| `SLOT_BLOCKED`       | Slot blocked                       | This slot is blocked                            |
| `PLATE_ACTIVE`       | Plate has an active visit          | This vehicle is already checked in              |
| `INVALID_PHONE`      | Not a valid Indian mobile          | Enter a valid 10-digit mobile number            |
| `INVALID_STATE`      | Transition not allowed             | This action isn't possible right now            |
| `HAS_ACTIVE_VISIT`   | Delete blocked                     | A vehicle is parked here (plate in message)     |
| `GEOMETRY_INVALID`   | Bad or self-intersecting geometry  | Shape is invalid. Redraw it                     |
| `OUTSIDE_ZONE`       | Slot not within zone               | Slot must be inside its zone                    |
| `OVERLAP`            | Slot overlaps another              | Slot overlaps another slot                      |
| `TOKEN_INVALID`      | Driver token bad, expired, revoked | This link has expired                           |
| `RATE_LIMITED`       | Too many requests                  | Too many tries. Wait a few minutes              |
| `AI_FAILED`          | Gemini error or timeout            | Couldn't read the photo. Enter details manually |
| `WA_FAILED`          | WhatsApp send failed               | WhatsApp message failed. Show the QR code       |
| `USERNAME_TAKEN`     | Staff username exists              | Username is already used                        |

## 2. Visit and slot state machine

### Visit status

```
            gate-checkin
                 │
                 ▼
            ┌─────────┐  driver_start_navigation   ┌──────────┐
            │assigned │ ─────────────────────────▶ │ en_route │
            └────┬────┘                            └────┬─────┘
                 │ driver_mark_parked                   │ driver_mark_parked
                 └──────────────┐   ┌──────────────────┘
                                ▼   ▼
                          ┌──────────────┐
                          │driver_parked │
                          └──────┬───────┘
     zone_confirm_parked         │ zone_confirm_parked
   (from assigned/en_route) ───▶ ▼
                          ┌──────────┐
                          │confirmed │
                          └────┬─────┘
                               │ mark_exit (from any active)
                               ▼
                          ┌────────┐
                          │ exited │
                          └────────┘
   cancel_visit: assigned | en_route  ─▶ cancelled
   reassign: any active except confirmed ─▶ assigned (new slot)
   admin reassign allowed from confirmed too
```

| From                              | To                  | Actor                        | Function                            |
| --------------------------------- | ------------------- | ---------------------------- | ----------------------------------- |
| (new)                             | assigned            | gate, admin                  | `gate-checkin` → `assign_new_visit` |
| assigned                          | en_route            | driver                       | `driver_start_navigation`           |
| assigned, en_route                | driver_parked       | driver                       | `driver_mark_parked`                |
| assigned, en_route, driver_parked | confirmed           | zone (own zone), admin       | `zone_confirm_parked`               |
| any active                        | exited              | gate, zone (own zone), admin | `mark_exit`                         |
| assigned, en_route                | cancelled           | gate, admin                  | `cancel_visit`                      |
| assigned, en_route, driver_parked | assigned (new slot) | gate, admin                  | `visit-reassign` → `reassign_visit` |
| confirmed                         | assigned (new slot) | admin only                   | same                                |

### Slot status

| Event                                     | Slot change                                       |
| ----------------------------------------- | ------------------------------------------------- |
| Visit assigned                            | available → assigned, `current_visit_id` set      |
| Driver marks parked or volunteer confirms | assigned → occupied                               |
| Exit, cancel                              | → available, `current_visit_id` null              |
| Reassign                                  | old slot → available; new slot → assigned         |
| Wrong slot correction                     | assigned slot → available; actual slot → occupied |
| Admin block                               | available → blocked (only from available)         |
| Admin unblock                             | blocked → available                               |

Every function that changes a slot does `select ... for update` on the slot row first.

## 3. Map RPCs (migration `rpc_map`)

### `get_event_map(p_event_id uuid) returns jsonb`

Roles: all authenticated with access to the event (driver only own event).
Returns one object; every geometry is GeoJSON via `ST_AsGeoJSON(...)::jsonb`.

```json
{
  "event": { "id": "...", "name": "...", "center": [76.6, 8.88], "default_zoom": 17, "base_map": "satellite",
             "arrival_radius_m": 20, "emergency_phone": "+91..." },
  "gates":   { "type": "FeatureCollection", "features": [ { "type":"Feature", "id":"<uuid>", "geometry":{...},
               "properties": { "name":"Main gate", "name_ml":"...", "kind":"both" } } ] },
  "zones":   { "type":"FeatureCollection", "features": [ { "properties": { "code":"A","name":"...","name_ml":"...",
               "color":"zone-1","vehicle_types":["car"],"categories":[],"is_overflow":false,"priority":100 } } ] },
  "slots":   { "type":"FeatureCollection", "features": [ { "properties": { "label":"A-012","number":12,"zone_id":"...",
               "vehicle_type":"car","is_accessible":false,"has_ev_charger":false } } ] },
  "roads":   { "nodes": [ { "id":"...","coord":[lng,lat] } ],
               "segments": [ { "id":"...","from":"<node>","to":"<node>","coords":[[lng,lat],...],
                               "direction":"one_way","name":null,"length_m":84.2,"walk_only":false } ] },
  "landmarks": { "type":"FeatureCollection", "features": [...] },
  "overlays": [ { "id":"...","url":"<signed url 12h>","corners":[[..],[..],[..],[..]],"opacity":0.85 } ]
}
```

Slot status is NOT included (it changes often). Use `get_slot_statuses`.

### `get_slot_statuses(p_event_id uuid) returns table(id uuid, status slot_status, current_visit_id uuid)`

Roles: staff. Drivers get only their own slot through their visit.

### Admin editor RPCs

All require `is_admin()`. All validate with `ST_IsValid`; invalid → `GEOMETRY_INVALID`. After each successful call, the client broadcasts `map-updated` on `event:<id>:map`.

| RPC                                               | Arguments                                                                                                                                | Logic                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --- | -------------------------------------------------------------------------------------------------------------------------------- |
| `admin_upsert_gate`                               | p_id uuid null, p_event_id, p_name, p_name_ml, p_kind, p_point jsonb (GeoJSON Point)                                                     | insert or update                                                                                                                                                                                                                                           |
| `admin_delete_gate`                               | p_id                                                                                                                                     | plain delete. Visit foreign keys to gates use `on delete set null`                                                                                                                                                                                         |
| `admin_upsert_zone`                               | p_id, p_event_id, p_code, p_name, p_name_ml, p_color, p_polygon jsonb, p_vehicle_types, p_categories, p_is_overflow, p_priority, p_notes | on update of `code`, relabel all slots `code-number` in the same transaction. On update of `area`, reject if any existing slot of this zone is not within the new area (`OUTSIDE_ZONE`, message lists up to 5 labels)                                      |
| `admin_delete_zone`                               | p_id                                                                                                                                     | reject with `HAS_ACTIVE_VISIT` if any slot has an active visit; else delete slots then zone                                                                                                                                                                |
| `admin_upsert_slots`                              | p_zone_id, p_slots jsonb array of `{id?, number, polygon, vehicle_type, is_accessible, has_ev_charger}`                                  | for each: validate within zone (`ST_Within(shape, ST_Buffer(zone.area::geography, 0.5)::geometry)`), validate overlap with other slots in event (`ST_Area(ST_Intersection(a,b)::geography) > 0.1 * ST_Area(a::geography)` → `OVERLAP`), label = `zone.code |     | '-' |     | lpad(number::text,3,'0')`, upsert. Changing `vehicle_type`of a slot with an active visit →`HAS_ACTIVE_VISIT`. Return saved slots |
| `admin_delete_slots`                              | p_ids uuid[]                                                                                                                             | reject all if any has an active visit (`HAS_ACTIVE_VISIT` with plates)                                                                                                                                                                                     |
| `admin_set_slots_status`                          | p_ids uuid[], p_status ('available' or 'blocked'), p_reason text                                                                         | only from available→blocked or blocked→available. Skips slots in other states and returns `{updated: n, skipped: [labels]}`                                                                                                                                |
| `admin_set_slots_props`                           | p_ids uuid[], p_vehicle_type null, p_is_accessible null, p_has_ev_charger null                                                           | bulk edit, null = unchanged                                                                                                                                                                                                                                |
| `admin_save_road_network`                         | p_event_id, p_nodes jsonb `[{id, coord}]`, p_segments jsonb `[{id, from, to, coords, direction, name, walk_only}]`                       | in one transaction: delete all segments and nodes of the event, insert new ones. Validate: every segment's first coord within 1.5 m of its from node, last within 1.5 m of its to node, length ≥ 1 m. Returns counts                                       |
| `admin_upsert_landmark` / `admin_delete_landmark` | usual                                                                                                                                    |                                                                                                                                                                                                                                                            |
| `admin_upsert_overlay` / `admin_delete_overlay`   | p_storage_path, p_corners, p_opacity, p_is_visible                                                                                       |                                                                                                                                                                                                                                                            |

## 4. Visit and gate RPCs (migration `rpc_visits`)

### `suggest_slots(p_event_id uuid, p_gate_id uuid, p_vehicle_type vehicle_type, p_category visitor_category, p_needs_accessible boolean, p_limit int default 5) returns jsonb`

Roles: gate_volunteer, admin.

Logic:

1. Effective type: `other` → try zones allowing `other`, else treat as `car`.
2. Candidate slots: `status = 'available'`, `vehicle_type = effective type`, zone `vehicle_types` contains the type.
3. Category match: zone `categories` is empty OR contains `p_category`. If `p_category = 'general'`, only zones with empty categories or containing `general`.
4. Exclude overflow zones unless no non-overflow candidates exist.
5. Accessible: if `p_needs_accessible`, prefer `is_accessible = true`; if none, fall back to any. If not needed, exclude accessible slots unless no other candidates (accessible slots are kept for people who need them).
6. Distance: `ST_Distance(slot.center::geography, gate.location::geography)`.
7. Order by: accessible match desc, exact category match (zone categories contains p_category) desc, zone.priority asc, distance asc, slot.number asc.
8. Limit, return:

```json
{ "suggestions": [ { "slot_id":"...","label":"A-012","zone_id":"...","zone_code":"A","zone_name":"North lawn",
                     "vehicle_type":"car","is_accessible":false,"has_ev_charger":false,"distance_m":120,
                     "is_overflow":false } ],
  "zone_free_counts": [ { "zone_id":"...","code":"A","name":"...","free":34,"total":60 } ],
  "fallback_used": "none" | "overflow" | "accessible" | "category_any" }
```

If still no candidate, step 3 relaxes to any category (`fallback_used = category_any`). If nothing at all, return empty `suggestions`.

### `find_active_visit_by_plate(p_event_id uuid, p_plate text) returns jsonb`

Roles: gate, admin, zone (zone sees only own zones). Normalises plate. Returns the active visit summary or null. Used for duplicate check and exit.

### `assign_new_visit(...) returns jsonb` — service role only

Called only by `gate-checkin`.

Arguments: p_event_id, p_driver_id, p_actor_id, p_gate_id, p_slot_id, p_plate_raw, p_vehicle_type, p_vehicle_color, p_vehicle_make, p_category, p_pass_number, p_pass_holder_name, p_needs_accessible, p_photo_path, p_ai_result jsonb, p_ai_plate_confidence, p_ai_edited, p_fee_amount, p_payment_method, p_allow_duplicate boolean, p_checkin_duration_ms int.

Steps:

1. Event must be `live` → else `NO_LIVE_EVENT`.
2. `plate := normalize_plate(p_plate_raw)`. If an active visit exists for plate and not `p_allow_duplicate` → `PLATE_ACTIVE`.
3. `select * from slots where id = p_slot_id for update`. Not found → `NOT_FOUND`. `status = 'blocked'` → `SLOT_BLOCKED`. `status <> 'available'` → `SLOT_TAKEN`. Type mismatch (after `other`→`car` rule) → `SLOT_TYPE_MISMATCH`.
4. Insert visit with status `assigned`, `zone_id` from slot.
5. Update slot: status `assigned`, `current_visit_id`, `status_changed_at = now()`.
6. `log_visit_event(visit,'checked_in',{gate, ai_edited})` and `log_visit_event(visit,'assigned',{slot_id,label})`.
7. Return `{visit_id, slot:{id,label,zone_code,zone_name}}`.

The unique partial indexes are the last line of defence; a unique violation is mapped to `PLATE_ACTIVE` or `SLOT_TAKEN`.

### `reassign_visit(p_visit_id uuid, p_new_slot_id uuid, p_actor_id uuid, p_actor_role app_role) returns jsonb` — service role only

Called by `visit-reassign`.

1. Lock visit. Must be active. If `confirmed` and actor is not admin → `INVALID_STATE`.
2. Lock new slot; same checks as assign step 3.
3. Old slot → available, `current_visit_id` null.
4. New slot → assigned. Visit: `slot_id`, `zone_id`, `status = 'assigned'`, `assigned_at = now()`, clear `driver_parked_at`, `driver_parked_location`, `driver_parked_distance_m`, `confirmed_at`, `confirmed_by`.
5. Resolve open alerts of types `not_arrived`, `confirm_pending`, `location_mismatch` for this visit (`resolution_note = 'reassigned'`).
6. Log `reassigned` with old and new labels.

### `driver_accept_location_consent() returns void`

Role: driver. Sets `drivers.location_consent_at = now()` for `current_driver_id()`.

### `driver_get_my_visit() returns jsonb`

Role: driver. Returns the latest visit of the driver for the event (active first, else most recent exited), joined with slot `{id,label,shape,center,vehicle_type,is_accessible}`, zone `{id,code,name,name_ml,color}`, entry gate `{id,name,location}`, and nearest landmark to the slot within 300 m `{name,name_ml,kind,distance_m}`.

### `driver_start_navigation() returns void`

Role: driver. On the active visit: if status `assigned` → `en_route`; set `navigation_started_at` if null. Log `navigation_started`. No error if already `en_route`.

### `driver_mark_parked(p_lng numeric, p_lat numeric, p_accuracy_m numeric) returns jsonb`

Role: driver.

1. Active visit with status in `assigned, en_route` → else `INVALID_STATE`. (If already `driver_parked` or `confirmed`, return current state without error.)
2. Distance: `ST_Distance(point::geography, slot.shape::geography)`. If lng/lat null (location denied), distance null.
3. Visit: `status = 'driver_parked'`, `driver_parked_at`, `driver_parked_location`, `driver_parked_distance_m`.
4. Slot assigned → occupied.
5. If distance > `events.location_tolerance_m + least(p_accuracy_m, 50)`: insert alert `location_mismatch` (dedupe key), `zone_id` = visit zone, message `"<distance> m from slot"`, `raised_by_system = true`, log event `location_mismatch`.
6. Log `driver_parked`. Return `{status, distance_m, mismatch: boolean}`.

### `record_position(p_lng numeric, p_lat numeric, p_accuracy_m numeric, p_heading numeric, p_speed_mps numeric) returns void`

Role: driver. Only for an active visit with status `assigned, en_route, driver_parked`. Updates `visits.last_position`, `last_position_at` every call. Inserts into `vehicle_positions` only if the last row for this visit is older than 15 s. Rejects accuracy > 200 m silently (no error, no write).

The client calls this every 15 s. Live movement between calls goes through broadcast only.

### `get_zone_visits(p_zone_ids uuid[] default null) returns jsonb`

Role: zone_volunteer (defaults to own zones; passing others → `FORBIDDEN`), admin (any).
Returns visits with status in `assigned, en_route, driver_parked, confirmed` plus visits exited in the last 30 minutes, each:

```json
{ "id","plate","vehicle_type","vehicle_color","vehicle_make","category","needs_accessible",
  "status","slot_id","slot_label","zone_id","zone_code","assigned_at","driver_parked_at","confirmed_at",
  "exited_at","driver_parked_distance_m","phone_masked","photo_path","last_position":[lng,lat] | null,
  "last_position_at","open_alert_types":["location_mismatch"] }
```

### `zone_confirm_parked(p_visit_id uuid, p_actual_slot_id uuid default null, p_note text default null) returns jsonb`

Role: zone_volunteer (visit zone in own zones, and `p_actual_slot_id` zone in own zones), admin.

1. Lock visit. Status must be `assigned, en_route, driver_parked` → else `INVALID_STATE` (if already `confirmed`, return current).
2. If `p_actual_slot_id` is null or equals `visit.slot_id`: slot → occupied; visit → `confirmed`, `confirmed_at`, `confirmed_by`. Resolve open `not_arrived`, `confirm_pending`, `location_mismatch` alerts for this visit with note `confirmed`. Log `confirmed`.
3. Else (wrong slot): lock actual slot; must be `available` (else `SLOT_TAKEN`) and same vehicle type group (car/ev/other interchangeable for this check; bike and bus strict), else `SLOT_TYPE_MISMATCH`. Old slot → available; actual slot → occupied with `current_visit_id`; visit `slot_id`, `zone_id` updated, `confirmed`. Insert alert `wrong_slot` with status `open`, message `"Assigned <old>, parked in <new>"`, raised_by_profile. Log `wrong_slot_corrected` and `confirmed`.
4. Return `{status:'confirmed', slot_label}`.

The driver page sees the slot change through realtime and updates.

### `zone_flag_not_here(p_visit_id uuid) returns void`

Role: zone (own zone), admin. Inserts or re-opens alert `not_arrived` for the visit (dedupe key), `raised_by_profile`. No visit status change.

### `mark_exit(p_visit_id uuid, p_exit_gate_id uuid default null) returns jsonb`

Role: gate, zone (own zone), admin. Visit must be active. Visit → `exited`, `exited_at`, `exited_by`, `exit_gate_id`. Slot → available, `current_visit_id` null. Resolve all open non-SOS alerts for the visit with note `exited`. Revoke nothing (driver link still shows a thank-you state until token expiry). Log `exited`.

### `cancel_visit(p_visit_id uuid, p_reason text) returns void`

Role: gate, admin. Status `assigned` or `en_route` only. Visit → `cancelled`. Slot → available. Resolve alerts. Revoke driver tokens for this driver only if the driver has no other active visit. Log `cancelled`.

### `get_gate_overview(p_event_id uuid, p_gate_id uuid) returns jsonb`

Roles: gate_volunteer, admin. Returns `{ "free_by_type": {"bike":60,"car":124,"ev":8,"bus":4,"other":0}, "recent": [ {"visit_id","plate","slot_label","status","checked_in_at"} ] }`. `recent` = last 5 visits checked in at this gate.

### `set_visit_fee(p_visit_id uuid, p_amount numeric, p_method payment_method) returns void`

Roles: gate_volunteer, admin. Visit must not be `cancelled`. `p_amount >= 0`; if `p_method = 'free'` the amount is forced to 0. Logs nothing extra (fee is visible in the visit row).

### `search_visits(p_event_id uuid, p_query text, p_status visit_status[] default null, p_limit int default 20) returns jsonb`

Role: gate, admin. `p_query` matches plate (trigram, also suffix match on last 4 digits), phone last 4 digits, pass number. Returns list with slot label, zone code, status, times, phone (full for admin and gate).

### `get_visit_detail(p_visit_id uuid) returns jsonb`

Role: admin, gate (any), zone (own zone). Visit row + driver (phone full for admin/gate, masked for zone) + slot + zone + gates + `visit_events` timeline + alerts + whatsapp_messages (admin/gate only) + last 200 positions (admin only, as a LineString).

## 5. Alerts and dashboard RPCs (migration `rpc_alerts_dashboard`)

### `raise_sos(p_reason sos_reason, p_message text, p_lng numeric, p_lat numeric) returns jsonb`

Role: driver. Rate limit: one open SOS per driver; if one is open, return it instead of creating another. Insert alert `sos`, `zone_id` = active visit zone (nullable), `raised_by_driver`. Log `sos` on the visit if any. The database webhook on `alerts` insert (type `sos`) calls `alert-dispatch`. Returns `{alert_id, emergency_phone}`.

### `report_wrong_parking(p_lng numeric, p_lat numeric, p_message text, p_photo_path text, p_plate text default null) returns jsonb`

Role: zone, admin. Insert alert `wrong_parking`. If `p_plate` matches an active visit, set `visit_id`. `zone_id` = zone containing the point (`ST_Contains`), else the reporter's first zone.

### `update_alert(p_alert_id uuid, p_status alert_status, p_note text default null) returns void`

Role: admin (all), zone (own zone alerts, except `sos`). Transitions: open → acknowledged → resolved, open → resolved. Sets `acknowledged_*` or `resolved_*`.

### `get_dashboard_summary(p_event_id uuid) returns jsonb`

Role: admin.

```json
{
  "slots": { "total":420, "available":180, "assigned":22, "occupied":210, "blocked":8 },
  "visits": { "active":232, "en_route":14, "awaiting_confirm":6, "confirmed":204, "exited":96, "checked_in_total":328 },
  "alerts": { "open":5, "sos_open":1 },
  "zones": [ { "id","code","name","color","total","available","assigned","occupied","blocked","occupancy_pct" } ],
  "gates": [ { "id","name","checkins_15m":12,"exits_15m":3 } ],
  "wa": { "sent":320, "delivered":300, "read":250, "failed":4 },
  "last_updated": "iso"
}
```

`occupancy_pct = (assigned + occupied) / (total - blocked)`.

### `get_recent_activity(p_event_id uuid, p_limit int default 30) returns jsonb`

Role: admin. Latest `visit_events` joined with plate and slot label.

### `get_live_vehicles(p_event_id uuid) returns jsonb`

Role: admin. Active visits with `last_position` in the last 5 minutes: `{visit_id, plate, status, vehicle_type, slot_label, lng, lat, at}`. Used to seed the live map before broadcast messages arrive.

### `get_road_traffic(p_event_id uuid) returns jsonb`

Role: admin. For each road segment, count of visits in status `assigned, en_route` whose `last_position` (last 60 s) is within 15 m of the segment. Returns `[{segment_id, vehicles}]`. The client recalculates this live from broadcast positions too (see `05-MAPS-AND-NAVIGATION.md` section 9); the RPC is the initial load.

## 6. Maintenance job: `run_maintenance()`

Runs every minute via pg_cron, as `postgres`. For the live event only.

1. `not_arrived`: visits in `assigned, en_route` with `assigned_at < now() - arrival_timeout_min`. Insert alert (dedupe `not_arrived:<visit>`), zone = visit zone.
2. `confirm_pending`: visits in `driver_parked` with `driver_parked_at < now() - confirm_timeout_min`. Insert alert.
3. `overstay`: visits in active statuses when `now() > ends_at + overstay_after_end_min`. Insert alert once.
4. Auto-resolve: open `not_arrived` / `confirm_pending` alerts whose visit is no longer in the triggering status → resolved, note `auto`.
5. Close stale tokens: nothing to do; expiry is checked on read.

## 7. Report RPCs

Defined in `docs/09-REPORTS.md`.

## 8. Edge Functions

Common rules:

- `supabase/functions/<name>/index.ts` with `Deno.serve`.
- CORS through `_shared/cors.ts` (allow `APP_URL` origin and localhost in dev).
- Auth: `requireRole(req, ['gate_volunteer','admin'])` reads the `Authorization` bearer, calls `auth.getUser(jwt)`, decodes claims, returns `{userId, role, claims}` or throws `FORBIDDEN`.
- Input validated with zod. Invalid → 400 `{error:{code:'BAD_REQUEST'}}`.
- Database writes with the service-role client from `_shared/supabaseAdmin.ts`.
- `verify_jwt` in `config.toml`: `false` for `driver-login`, `driver-resend-link`, `whatsapp-webhook`, `alert-dispatch` (it checks a shared secret header); `true` for the rest.

### 8.1 `extract-vehicle`

Role: gate_volunteer, admin. Details of the Gemini call in `docs/08-WHATSAPP-AND-AI.md` section 3.

Request: `{ "photo_paths": ["<event>/<date>/<uuid>.jpg"], "event_id": "uuid" }` (1 or 2 photos).

Steps:

1. Download each photo from `vehicle-photos` with service role.
2. Call Gemini with the images, prompt, and schema. Timeout 12 s (`AbortController`).
3. Post-process: `plate = normalizePlate(plate_number)`; `plate_valid = isValidIndianPlate(plate)`; clamp confidences to 0..1; map unknown enum values to `null`.
4. Return `{ "result": { plate, plate_raw, plate_valid, plate_confidence, vehicle_type, vehicle_type_confidence, vehicle_color, vehicle_make, pass_detected, pass_category, pass_number, pass_holder_name }, "model": "<name>", "ms": 2140 }`.
5. On error or timeout: 200 with `{ "result": null, "error": { "code": "AI_FAILED" } }`. The UI continues manually.

### 8.2 `gate-checkin`

Role: gate_volunteer, admin.

Request:

```json
{
  "event_id":"uuid","gate_id":"uuid","slot_id":"uuid",
  "phone":"9876543210","driver_name":"optional","language":"en",
  "plate_raw":"KL 02 AB 1234","vehicle_type":"car","vehicle_color":"white","vehicle_make":"Maruti",
  "category":"guest","pass_number":"G-0042","pass_holder_name":"...","needs_accessible":false,
  "photo_path":"...","ai_result":{...},"ai_plate_confidence":0.93,"ai_edited":false,
  "fee_amount":0,"payment_method":"free","allow_duplicate":false,
  "checkin_duration_ms":38200
}
```

Steps:

1. `requireRole`. If gate volunteer has non-empty `gate_ids`, `gate_id` must be in it.
2. `phone_e164 = normalizeIndianPhone(phone)` using libphonenumber-js rules: 10 digits starting 6-9 → `+91…`. Invalid → `INVALID_PHONE`.
3. Load event; must be live.
4. `allow_duplicate` true is honoured only for admin.
5. Fee: if `event.paid_parking` false → force `fee_amount = 0, payment_method = 'free'`. If category in `fee_exempt_categories` → force free.
6. Driver upsert by `(event_id, phone_e164)`. Update `name` if provided and `preferred_language = language`. If `auth_user_id` is null: `auth.admin.createUser({ email: 'd_<driver_id>@<DRIVER_EMAIL_DOMAIN>', email_confirm: true, user_metadata: { driver_id } })` and store the id.
7. Call RPC `assign_new_visit`. Map errors to codes and return 409 for `SLOT_TAKEN`, `PLATE_ACTIVE`, `SLOT_BLOCKED`, `SLOT_TYPE_MISMATCH`.
8. Token: raw = 32 random bytes base64url; insert hash with `expires_at = event.ends_at + interval '6 hours'`.
9. `link = APP_URL + '/d/' + raw`.
10. Insert `whatsapp_messages` row status `queued`. Send template `parking_slot_assigned` (see `08-WHATSAPP-AND-AI.md`). On success store `wa_message_id`, status `sent`, log visit event `link_sent`. On failure store error, status `failed`.
11. Respond 200:

```json
{ "visit_id":"...","slot":{"id":"...","label":"A-012","zone_code":"A","zone_name":"North lawn"},
  "link":"https://.../d/<token>","whatsapp":{"message_id":"<row id>","status":"sent"|"failed","error":null|"..."} }
```

The link is returned to the gate device only for the QR code. It is never logged.

### 8.3 `driver-login`

Public. Rate limit 20 per IP per 10 minutes.

Request `{ "token": "<raw>" }`.

1. Hash, look up token. Missing, revoked, or expired → 401 `TOKEN_INVALID`.
2. Load driver; ensure `auth_user_id` exists.
3. `auth.admin.generateLink({ type: 'magiclink', email: <driver synthetic email> })` → `properties.hashed_token`.
4. Update `last_used_at`, `use_count + 1`. If this is the first use for the active visit, set `visits.link_opened_at` and log `link_opened`.
5. Return `{ "token_hash": "...", "event_id": "...", "language": "ml" }`.

Client: `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`, then `i18n.changeLanguage(language)`, `history.replaceState(null, '', '/driver')`, navigate to `/driver`.

### 8.4 `driver-resend-link`

Public. Rate limit 3 per phone per hour and 20 per IP per hour.

Request `{ "phone": "9876543210" }`.

1. Normalise phone. Invalid → 400 `INVALID_PHONE`.
2. Live event required; if none, still return the generic success.
3. Find driver in the live event with an active visit or a visit exited in the last 12 hours.
4. If found: new token (existing tokens stay valid), send template `parking_login_link`, insert message row.
5. Always return 200 `{ "ok": true }` (no account enumeration).

### 8.5 `visit-reassign`

Role: gate_volunteer, admin.
Request `{ "visit_id", "new_slot_id", "notify": true }`.

1. Call `reassign_visit`.
2. If `notify`: send template `parking_slot_changed` to the driver with a fresh token link. Insert message row.
3. Return `{ slot, whatsapp }`.

### 8.6 `whatsapp-webhook`

Public.

- GET: if `hub.mode=subscribe` and `hub.verify_token == WHATSAPP_VERIFY_TOKEN` return `hub.challenge`, else 403.
- POST: verify `X-Hub-Signature-256` (HMAC SHA-256 of raw body with `WHATSAPP_APP_SECRET`). Invalid → 401.
  - `statuses[]`: update `whatsapp_messages` by `wa_message_id`. Only move forward: queued < sent < delivered < read. `failed` always applies. Store `errors[0].code/title`.
  - `messages[]` (inbound from a driver): find driver by phone in live event. If found with active or recent visit, reply with a free-form text (within the 24-hour window opened by their message) containing a fresh link and the slot label, in the driver's language. If not found, reply with a short "No active parking found for this number" text. Ignore non-text types except to send the same reply.
- Always respond 200 quickly after processing (Meta retries on non-200).

### 8.7 `alert-dispatch`

Called by a Supabase Database Webhook on `alerts` INSERT where `type = 'sos'`. The webhook sends header `x-webhook-secret` = a secret stored with `supabase secrets set ALERT_WEBHOOK_SECRET=...`; the function rejects other calls.

1. Load alert, driver phone, visit plate, slot label, event `admin_alert_phones`.
2. Send template `sos_admin_alert` to each admin phone.
3. Insert message rows (driver_id null).

### 8.8 `admin-staff`

Role: admin. Request `{ "action": "create" | "update" | "deactivate" | "activate" | "reset_password", ... }`.

| Action         | Input                                                                               | Logic                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| create         | username, full_name, role (not driver), phone, zone_ids, gate_ids, password (min 8) | check username free (`USERNAME_TAKEN`), `auth.admin.createUser({email: username@STAFF_EMAIL_DOMAIN, password, email_confirm: true})`, insert profile |
| update         | id, full_name, role, phone, zone_ids, gate_ids, preferred_language                  | update profile, then `auth.admin.signOut(id)` if role or zones changed so new claims apply                                                           |
| deactivate     | id                                                                                  | `is_active = false`, `auth.admin.signOut(id)`. An admin cannot deactivate themselves                                                                 |
| activate       | id                                                                                  | `is_active = true`                                                                                                                                   |
| reset_password | id, password                                                                        | `auth.admin.updateUserById(id, {password})`, sign out                                                                                                |

Username is immutable after create.

### 8.9 `admin-assistant`

Role: admin. See `docs/08-WHATSAPP-AND-AI.md` section 4.

Request `{ "session_id": "uuid", "message": "text", "language": "en" | "ml" }`.
Response `{ "reply": "markdown", "tools_used": [ { "name", "args", "ms" } ] }`.

## 9. Database webhooks

Create in the dashboard or via migration using `supabase_functions.http_request` trigger:

| Name           | Table  | Event  | Condition                                       | Target                                          |
| -------------- | ------ | ------ | ----------------------------------------------- | ----------------------------------------------- |
| `sos_dispatch` | alerts | INSERT | inside function: return early unless type = sos | `alert-dispatch` with header `x-webhook-secret` |

## 10. Client API wrappers

Each feature's `api.ts` exports typed functions. Names are fixed:

| File                      | Functions                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/auth/api.ts`    | `staffSignIn`, `signOut`, `exchangeDriverToken`, `requestDriverLink`                                                                                                                                                                                                                                          |
| `features/map/api.ts`     | `fetchEventMap`, `fetchSlotStatuses`                                                                                                                                                                                                                                                                          |
| `features/gate/api.ts`    | `uploadVehiclePhoto`, `extractVehicle`, `findActiveVisitByPlate`, `suggestSlots`, `gateCheckin`, `searchVisits`, `reassignVisit`, `cancelVisit`, `markExit`, `resendDriverLink` (calls `driver-resend-link` with the visit's phone)                                                                           |
| `features/driver/api.ts`  | `getMyVisit`, `acceptLocationConsent`, `startNavigation`, `markParked`, `recordPosition`, `raiseSos`                                                                                                                                                                                                          |
| `features/zone/api.ts`    | `getZoneVisits`, `confirmParked`, `flagNotHere`, `reportWrongParking`, `uploadAlertPhoto`, `markExit`                                                                                                                                                                                                         |
| `features/admin/*/api.ts` | `getDashboardSummary`, `getRecentActivity`, `getLiveVehicles`, `getRoadTraffic`, `getVisitDetail`, `updateAlert`, editor `admin_*` wrappers, `staffAction`, `askAssistant`, report wrappers, event CRUD (`upsertEvent`, `setEventLive`, `closeEvent` via RPCs `admin_upsert_event`, `admin_set_event_status`) |

### Event RPCs

- `admin_upsert_event(p jsonb)`: admin; validates fields listed in `events`.
- `admin_set_event_status(p_event_id, p_status)`: draft → live (fails if another event is live: `INVALID_STATE`), live → closed, closed → live allowed only if `ends_at > now()`. On close: all active visits stay as they are; driver tokens for the event get `revoked_at = now()`.
