# 09. Reports

All report RPCs live in migration `rpc_reports`. Role: admin. All take `p_event_id`, optional `p_from`, `p_to` (timestamptz, default event `starts_at - 3h` to `least(now(), ends_at + 6h)`), optional `p_zone_ids uuid[]` (null = all). Time buckets are computed in `Asia/Kolkata` and returned as ISO strings with offset.

Definitions used everywhere:

- **Arrival time** = `checked_in_at`.
- **Parked interval** = from `coalesce(driver_parked_at, confirmed_at)` to `coalesce(exited_at, cancelled_at, now())`. A visit with neither parked timestamp is not counted as occupying.
- **Holding interval** (for occupancy including assigned) = from `assigned_at` of the first assignment (`checked_in_at`) to `coalesce(exited_at, cancelled_at, now())`.
- Cancelled visits are excluded from counts and revenue but included in the raw export with their status.
- Zone for a visit = the final `zone_id` (after reassign or wrong-slot correction).

## 1. Occupancy — F-RPT-01

### `report_occupancy(p_event_id, p_from, p_to, p_interval_min int default 15, p_zone_ids uuid[] default null) returns jsonb`

For each zone and each bucket end time `t` in `generate_series(date_bin(interval, p_from), p_to, interval)`:

```sql
parked   = count(*) where parked interval contains t
holding  = count(*) where holding interval contains t
capacity = count(slots in zone) - count(slots blocked now)   -- blocked history is not tracked; use current
pct      = round(100.0 * parked / nullif(capacity,0), 1)
```

Returns:

```json
{ "interval_min": 15,
  "zones": [ { "zone_id","code","name","color","capacity" } ],
  "series": [ { "t":"2026-10-10T10:15:00+05:30", "values": { "<zone_id>": { "parked": 22, "holding": 26, "pct": 36.7 } },
                "total": { "parked": 140, "holding": 158, "pct": 33.3 } } ],
  "peaks": [ { "zone_id", "max_pct": 96.0, "at": "..." } ] }
```

UI: line chart (recharts `LineChart`), x = time, y = % full (0–100), one line per zone in zone colour, plus total in `ink` 2 px dashed. Toggle "Show counts" switches y to parked count. Table below: Zone, Capacity, Peak %, Peak time, Average % during event hours, Time above 90%.

"Time above 90%" = number of buckets with pct ≥ 90 × interval, shown as `1 h 15 min`.

## 2. Peak hours — F-RPT-02

### `report_peak_hours(p_event_id, p_from, p_to, p_interval_min int default 15, p_zone_ids uuid[] default null) returns jsonb`

```sql
arrivals per bucket = count(*) where checked_in_at in [bucket_start, bucket_start + interval)
exits per bucket    = count(*) where exited_at    in [bucket_start, bucket_start + interval)
```

Also per gate for arrivals and exits.

```json
{ "series": [ { "t": "...", "arrivals": 42, "exits": 3 } ],
  "by_gate": [ { "gate_id","name","arrivals":[...same buckets],"exits":[...] } ],
  "busiest_arrival": { "t": "...", "count": 58 },
  "busiest_exit": { "t": "...", "count": 71 },
  "median_checkin_seconds": 38,
  "median_time_to_confirm_minutes": 7.5 }
```

- `median_checkin_seconds`: the gate client measures the time from opening step 1 to receiving the `gate-checkin` response and sends it as `checkin_duration_ms` in the request. Stored in `visits.checkin_duration_ms int` (column added in migration `drivers_visits`). Median over non-null values.
- `median_time_to_confirm_minutes`: median of `confirmed_at - checked_in_at`.

UI: grouped bar chart arrivals vs exits per bucket (arrivals `primary`, exits `status-occupied`). Two KPI cells above: busiest arrival window ("10:15 to 10:30 am, 58 vehicles"), busiest exit window. Table: Time window, Arrivals, Exits, and per-gate columns.

## 3. Revenue — F-RPT-03

### `report_revenue(p_event_id, p_from, p_to, p_zone_ids uuid[] default null) returns jsonb`

Only visits with status not `cancelled`.

```json
{ "total": 12400, "count_paid": 520, "count_free": 380,
  "by_zone":   [ { "zone_id","code","name","amount","count" } ],
  "by_day":    [ { "date":"2026-10-10","amount","count" } ],
  "by_method": [ { "method":"cash","amount","count" }, { "method":"upi", ... }, { "method":"free","amount":0,"count":380 } ],
  "by_vehicle_type": [ { "type":"car","amount","count" } ] }
```

Day = date of `checked_in_at` in IST.

UI: KPI strip (Total collected, Paid vehicles, Free vehicles, Cash, UPI). Bar chart by zone. Table by day. Table by method. If `paid_parking` is false for the event, show empty state "Paid parking is off for this event." with a link to Settings.

## 4. Vehicle counts — F-RPT-04

### `report_vehicle_counts(p_event_id, p_from, p_to, p_zone_ids uuid[] default null) returns jsonb`

```json
{ "total": 900,
  "by_category": [ { "category":"student","count":410 } ],
  "by_type":     [ { "type":"bike","count":380 } ],
  "matrix":      [ { "category":"student","bike":300,"car":100,"ev":8,"bus":0,"other":2,"total":410 } ],
  "by_zone":     [ { "zone_id","code","name","count" } ],
  "accessible": 12,
  "ai": { "photos": 860, "plate_edited": 94, "accuracy_pct": 89.1 },
  "whatsapp": { "sent": 890, "failed": 10 },
  "confirmation": { "confirmed": 870, "wrong_slot": 14, "location_mismatch": 21 } }
```

UI: horizontal bar charts by category and by type side by side; matrix table (category rows × type columns + totals row and column); small table of quality numbers (AI accuracy, WhatsApp failures, wrong slots).

## 5. Reports page layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Reports                                  [Export Excel] [Export PDF] │
├──────────────────────────────────────────────────────────────────────┤
│ Event [Demo Fest ▾]  From [__] To [__]  Zones [All ▾]  Interval [15 min ▾] │
├──────────────────────────────────────────────────────────────────────┤
│ Tabs: Occupancy | Peak hours | Revenue | Vehicle counts               │
├──────────────────────────────────────────────────────────────────────┤
│ KPI strip (tab-specific)                                              │
│ Chart, height 360                                                     │
│ Table                                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

- Filters are kept in the URL query (`?tab=occupancy&from=...`), so a report view can be shared.
- Charts: recharts with tokens from `colors.ts`, grid lines `line`, axis text `text-caption text-muted`, tooltip `bg-surface border shadow-overlay`. No chart titles inside charts (the tab names it). Legends at the bottom.
- Empty state for no data: "No vehicles in this time range."

## 6. Exports — F-RPT-05

Both built in the browser from the same RPC results plus `export_visits` for raw rows.

### `export_visits(p_event_id, p_from, p_to, p_zone_ids) returns setof jsonb`

Admin. One object per visit: plate, vehicle type, colour, make, category, pass number, pass holder name, accessible, phone, driver name, entry gate, checked in, slot, zone, status, link opened, driver parked, parked distance m, confirmed, confirmed by (name), exited, exit gate, fee, payment method, AI plate confidence, AI edited, WhatsApp status. Paged by the client in batches of 1,000 with `range()`.

### Excel (exceljs) — `features/admin/reports/exportExcel.ts`

File name: `<event-name-slug>-parking-<yyyy-mm-dd>.xlsx`.

| Sheet | Content |
|---|---|
| Summary | Event name, dates, generated at, filters, key numbers (total vehicles, peak occupancy, busiest arrival, revenue total) |
| Occupancy | Time + one column per zone (%), plus parked counts block |
| Peak hours | Time, arrivals, exits, per gate |
| Revenue | By zone, by day, by method (three tables stacked with a blank row) |
| Vehicle counts | Category × type matrix, by zone |
| Vehicles | Raw `export_visits` rows |
| Alerts | Type, status, plate, zone, raised by, created, resolved, note |

Formatting: header row bold with `surface-2` fill, frozen top row, auto column widths (max 40), dates as Excel dates in IST, numbers as numbers. Malayalam text is kept as is.

### PDF (jspdf + jspdf-autotable) — `features/admin/reports/exportPdf.ts`

- A4 portrait, English only. Malayalam names are replaced by their English names (zone `name`, landmark `name`).
- Page 1: title "Parking report", event name, dates, generated time; summary numbers table.
- Page 2+: one section per report: section title, chart image, table.
- Charts: render each recharts chart into an offscreen container, serialise the SVG, draw onto a canvas at 2× scale, `canvas.toDataURL('image/png')`, add with `doc.addImage`.
- Footer on each page: "Page n of m" and event name.
- Font: jsPDF built-in Helvetica. Do not embed Manrope.
- The raw vehicles list is not in the PDF (use Excel).