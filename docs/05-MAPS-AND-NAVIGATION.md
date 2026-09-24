# 05. Maps and Navigation

## 1. Map stack

| Layer | Source | Notes |
|---|---|---|
| Street base | OpenFreeMap `liberty` style (`VITE_MAP_STREET_STYLE`) | Free, no key. Attribution must stay visible |
| Satellite base | MapTiler Satellite raster tiles `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=<VITE_MAPTILER_KEY>` | Free tier. If key missing, hide the satellite option |
| Custom overlay | `map_overlays` image source with 4 corners | Drone photo or site plan, drawn above base, below data |
| Event data | GeoJSON sources built from `get_event_map` | zones, slots, roads, gates, landmarks |
| Live data | GeoJSON sources updated in place | driver puck, route, vehicles, traffic |

Rendering: `react-map-gl/maplibre` `<Map>` with `mapLib={import('maplibre-gl')}` loaded lazily. One shared component `BaseMap` in `src/features/map/BaseMap.tsx`:

```ts
type BaseMapProps = {
  eventMap: EventMapData;
  baseLayer: 'street' | 'satellite';
  interactive?: boolean;            // default true
  fitTo?: 'event' | 'zone' | 'route' | { bbox: [number, number, number, number] };
  children?: React.ReactNode;       // extra <Source>/<Layer> or markers
  onSlotClick?: (slotId: string) => void;
  slotStatuses?: Map<string, SlotStatus>;
  highlightSlotId?: string;
  visibleZoneIds?: string[];        // default all
  showRoads?: boolean;              // default: editor and admin true, others false
};
```

Satellite base is built as a style object in code (raster source + raster layer). Switching base layer calls `map.setStyle()` and re-adds data layers in the `style.load` handler. Data sources and layers are defined once in `src/features/map/style/layers.ts`.

Max zoom 21 for satellite (tiles upscale beyond native), 20 for street. Min zoom 14. `maxBounds` = event bbox (all zones and gates) buffered by 500 m.

## 2. Layer order (bottom to top)

1. Base map
2. `overlay-image`
3. `zones-fill` (fill, zone colour, opacity 0.10)
4. `zones-line` (line, zone colour, 2 px)
5. `roads-casing` (line, white, 9 px) and `roads-line` (line, `--map-road`, 6 px). Admin and editor only.
6. `roads-oneway-arrows` (symbol, `arrow-sdf` icon along line, `symbol-placement: line`, spacing 40 px, only `direction = one_way`)
7. `slots-fill` (fill, colour by status, opacity 0.9)
8. `slots-line` (line, white, 1 px)
9. `slots-highlight` (line, `--color-primary`, 3 px, filter by `highlightSlotId`)
10. `slots-label` (symbol, `label`, minzoom 18.5, text size 11, halo white 1.2)
11. `route-casing` (white 11 px) and `route-line` (`--map-route` 7 px), `route-last-leg` (dashed 3 px)
12. `vehicles` (circle 7 px, colour by visit status, white stroke 2 px) admin only
13. `gates` (symbol, icon), `landmarks` (symbol, icon + name at zoom 17+)
14. `zones-label` (symbol at polygon label point: zone name + free count, text size 13, weight 600)
15. User puck (HTML marker): accuracy circle + dot + heading cone

Colours for slot status come from tokens in `06-DESIGN-SYSTEM.md` section 4 and are exported as JS constants in `src/features/map/style/colors.ts` (the only place map hex values live).

Accessible slots show a small wheelchair symbol at the centre at zoom ≥ 18.5. EV charger slots show a bolt symbol. Blocked slots use a hatch pattern image `hatch` added with `map.addImage`.

## 3. Map editor

Route `/admin/map-editor`. Terra Draw with `TerraDrawMapLibreGLAdapter`. Modes registered:

| Tool | Terra Draw mode | Produces |
|---|---|---|
| Select | `TerraDrawSelectMode` with flags per feature kind (drag, rotate for slots, coordinate edit for zones and roads) | Edit existing |
| Zone | `TerraDrawPolygonMode` | Zone polygon |
| Slot row | `TerraDrawLineStringMode` (2 points only) | Baseline for generator |
| Single slot | `TerraDrawRectangleMode` then rotate in select | One slot polygon |
| Road | `TerraDrawLineStringMode` | Road line |
| Gate | `TerraDrawPointMode` | Gate point |
| Landmark | `TerraDrawPointMode` | Landmark point |
| Overlay | Custom: image placement with 4 draggable corner markers | Overlay corners |

Features loaded from the database are added to Terra Draw with `properties.kind` (`zone`, `slot`, `road`, `gate`, `landmark`) and `properties.dbId`. New features have `dbId = null` and render dashed until saved.

### 3.1 Editor store (`features/admin/map-editor/store.ts`, zustand)

```ts
type EditorState = {
  tool: 'select' | 'zone' | 'slotRow' | 'slot' | 'road' | 'gate' | 'landmark' | 'overlay';
  selectedIds: string[];                 // terra draw ids
  dirty: Record<string, 'new' | 'changed' | 'deleted'>;
  roadsDirty: boolean;                   // roads saved as a whole
  layers: { zones: boolean; slots: boolean; roads: boolean; gates: boolean; landmarks: boolean; overlay: boolean; labels: boolean };
  baseLayer: 'street' | 'satellite';
  activeZoneId: string | null;           // slot tools require a zone
  snapping: boolean;                     // default true
};
```

### 3.2 Saving rules

- Zones, slots, gates, landmarks save individually from the properties panel ("Save zone", "Save slots", …) through the `admin_*` RPCs.
- Roads save together with "Save roads" in the top bar. The button is enabled when `roadsDirty`.
- Leaving the page with unsaved changes shows a confirm dialog.
- After any save, broadcast `map-updated` and invalidate `queryKeys.eventMap(eventId)`.

### 3.3 Client-side validation before calling RPCs (`lib/geo/validation.ts`)

| Check | Function | Rule |
|---|---|---|
| Polygon valid | `isValidPolygon(p)` | ≥ 4 coords, closed, `turf.kinks(p).features.length === 0` |
| Zone area | | 50 m² to 200,000 m² |
| Slot inside zone | `slotInsideZone(slot, zone)` | `turf.booleanWithin(slot, turf.buffer(zone, 0.5, {units:'meters'}))` |
| Slot overlap | `slotOverlaps(slot, others)` | intersection area > 10% of slot area |
| Slot size | | area 0.8 m² to 60 m² |
| Road length | | ≥ 1 m |

Invalid features show a red outline and the error text in the properties panel. The server repeats the checks.

## 4. Slot row generator (`lib/geo/slotGenerator.ts`)

The admin draws a baseline (2 points) inside a zone. A dialog opens with a live preview on the map.

### Inputs

| Field | Default by type | Range |
|---|---|---|
| Vehicle type | zone's first type | bike, car, ev, bus |
| Slot width (m) | bike 1.0, car 2.5, ev 2.7, bus 3.5 | 0.8 to 5 |
| Slot depth (m) | bike 2.0, car 5.0, ev 5.0, bus 12.0 | 1.5 to 15 |
| Angle (degrees) | 90 | 90, 60, 45 |
| Side | left | left, right (relative to drawn direction) |
| Gap between slots (m) | 0 | 0 to 2 |
| Count | auto-fit | 1 to 200. "Fit to line" toggle computes max |
| Start number | next free number in zone | 1 to 999 |
| Accessible | off | marks all generated slots |
| EV charger | off | |

### Algorithm

```ts
export function generateSlotRow(input: SlotRowInput): Feature<Polygon>[] {
  // 1. baseline from A to B. bearing = turf.bearing(A, B). lineLength in metres.
  // 2. pitch along the line = width / sin(angle) + gap   (for 90°, sin = 1)
  // 3. count = fit ? floor((lineLength + gap) / pitch) : input.count
  // 4. For i in 0..count-1:
  //      p0 = turf.destination(A, i * pitch, bearing)                // front-left corner on baseline
  //      p1 = turf.destination(p0, width / sin(angle), bearing)       // front-right on baseline
  //      depthBearing = bearing + (side === 'left' ? -1 : 1) * angle  // slot runs away from baseline
  //      p2 = turf.destination(p1, depth, depthBearing)
  //      p3 = turf.destination(p0, depth, depthBearing)
  //      polygon = [p0, p1, p2, p3, p0]
  // 5. properties: { number: start + i, vehicle_type, is_accessible, has_ev_charger }
}
```

All distances in metres with `{ units: 'meters' }`. Unit tests must cover 90° and 45°, both sides, fit-to-line, and that adjacent slots touch without overlap.

Preview shows slots valid in the status colour `available` and invalid ones in `--color-danger` outline. "Add slots" saves only if all are valid; otherwise the button reads "Fix overlaps first" and is disabled.

## 5. Road network

### 5.1 Drawing

- Road tool draws a line string. With snapping on, each vertex within 3 m of an existing road vertex or road line snaps to it (`lib/geo/snapping.ts` using `turf.nearestPointOnLine`).
- Properties panel for a road: name (optional), direction (two-way, one-way), walk only (footpath), "Reverse direction" button (reverses coordinates).
- One-way roads show arrows in the drawn direction.

### 5.2 Building the graph on save (`lib/geo/roadGraph.ts`)

```ts
export function buildRoadNetwork(lines: RoadLine[]): { nodes: RoadNode[]; segments: RoadSegment[] }
```

1. Collect all lines.
2. Find intersections between every pair (`turf.lineIntersect`). Add each intersection point as a split point on both lines.
3. Add each line's endpoints as split points.
4. Split each line at its split points (`turf.lineSplit` with a multipoint, or manual splitting by distance along the line).
5. Create nodes by clustering split points within 1.5 m (take the first point's coordinate). Give each a uuid (reuse the old node id if a previous node is within 1.5 m, so ids stay stable).
6. Each piece becomes a segment: `from` = node at its start, `to` = node at its end, `direction` and `name` and `walk_only` inherited from the parent line. Force the piece's first and last coordinates to equal the node coordinates.
7. Drop pieces shorter than 1 m.
8. Return for `admin_save_road_network`.

Also run `validateConnectivity(network, gates, zones)`: every gate must be within 30 m of the network and every zone must have a network point within 30 m of its polygon. Show warnings (not errors) in the editor top bar: "Zone C is not connected to the road network".

## 6. Routing (`lib/geo/routing.ts`)

### 6.1 Graph

```ts
export function createGraph(net: RoadNetwork, mode: 'drive' | 'walk'): Graph
```

- ngraph.graph. Node data = `[lng, lat]`. Link data = `{ segmentId, coords, length, reversed }`.
- Drive: skip `walk_only`. `two_way` → add links both ways (reversed coords for the back link). `one_way` → only from → to.
- Walk: include all segments, all as two-way.
- Cache graphs per `(eventMapVersion, mode)`.

### 6.2 Path

```ts
export function findRoute(graph: Graph, net: RoadNetwork, from: LngLat, to: LngLat, mode): Route | null
```

1. Snap start: nearest point on any usable segment (`turf.nearestPointOnLine`) → `startSnap {segmentId, point, location (distance along)}`. If the nearest distance > 150 m → return null (driver is not on campus yet; show "Head to the campus gate" state).
2. Snap end: nearest point on any usable segment to the slot centre.
3. Insert two temporary nodes by splitting the snapped segments (respect one-way: on a one-way segment the temporary start node links only forward).
4. Run `ngraph.path.aStar(graph, { oriented: true, distance: link length, heuristic: haversine })`.
5. Build the route line by concatenating link coords. Remove the temp nodes from the graph afterwards.
6. Return:

```ts
type Route = {
  line: Feature<LineString>;         // on-road part
  lastLeg: Feature<LineString>;      // snapped end point to slot centre (dashed)
  firstLeg: Feature<LineString> | null; // current position to snapped start (dashed), if > 5 m
  distanceM: number;                 // total incl. legs
  steps: Step[];                     // from instructions.ts
};
```

If no path: return `null` and the UI shows a straight dashed line to the slot plus the message "Follow the volunteers' directions to Zone A".

## 7. Turn instructions (`lib/geo/instructions.ts`)

```ts
type Step = { type: 'start' | 'straight' | 'slight_left' | 'slight_right' | 'left' | 'right' | 'sharp_left' | 'sharp_right' | 'uturn' | 'arrive';
              distanceM: number; roadName: string | null; at: [number, number] };
```

1. Simplify the route line (`turf.simplify`, tolerance 0.000005) to remove GPS-like noise from drawn roads.
2. Walk vertices. For each vertex compute `delta = normalize(bearingOut - bearingIn)` in −180..180.
3. Classify: |delta| < 25 → straight (merge into previous step), 25–45 slight, 45–135 turn, 135–170 sharp, > 170 uturn. Negative = left.
4. Distances between turns are summed. The last step is `arrive` with the last leg distance.

Rendered text (i18n `driver.nav.*`): "Turn left in 40 m", "Continue for 120 m", "Your slot is on the right". Side for arrival: sign of the cross product of the last road bearing and the vector to the slot centre.

Distances shown rounded: under 100 m to nearest 10 m, else nearest 50 m. Under 20 m show "Now".

## 8. Live location (driver)

### 8.1 `useLiveLocation` hook

```ts
useLiveLocation({ enabled: boolean }): {
  status: 'idle' | 'prompt' | 'denied' | 'unavailable' | 'watching';
  fix: { lng: number; lat: number; accuracy: number; heading: number | null; speed: number | null; at: number } | null;
}
```

- `navigator.geolocation.watchPosition` with `{ enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }`.
- Ignore fixes with accuracy > 100 m for display smoothing; still show accuracy circle.
- Heading: use `coords.heading` when speed > 1 m/s, else keep last heading.
- Stops on unmount or `enabled = false`.

### 8.2 Sharing

While status is `assigned`, `en_route`, or `driver_parked` (not after `confirmed`):
- Broadcast on `event:<event_id>:positions` (private channel) at most every 3 s or when moved > 10 m: `{ visit_id, lat, lng, acc, hdg, spd, t }`.
- Call `record_position` every 15 s.
- Stop both when visit becomes `confirmed`, `exited`, or `cancelled`, or when the driver turns off sharing (toggle in the menu; off by explicit choice only).

### 8.3 Navigation loop (NavigatePage)

On each new fix:
1. If no route yet or `routeInvalidated`: compute `findRoute(driveGraph, fix, slotCenter)`.
2. Off-route check: distance from fix to `route.line` > 25 m on 2 consecutive fixes with accuracy < 40 m → recompute.
3. Progress: `turf.nearestPointOnLine(route.line, fix).properties.location` → remaining distance and current step index.
4. Arrival: distance from fix to slot polygon < `arrival_radius_m` → show arrival sheet once.
5. Camera: follow mode keeps the puck at 65% height, zoom 18, bearing = heading when moving (if "rotate map" is on; default off, north up). Any user pan disables follow; a "Recenter" button restores it.

Wake lock: request `navigator.wakeLock.request('screen')` when navigation starts; re-request on `visibilitychange` to visible.

## 9. Admin live traffic

Route `/admin/live`.

- Seed with `get_live_vehicles` and `get_road_traffic`.
- Subscribe to `event:<id>:positions`. Keep `Map<visitId, Position>` in a ref; flush to the GeoJSON source every 1 s with `source.setData`.
- Vehicle circle colour by visit status: assigned and en_route = `--status-enroute`, driver_parked = `--status-waiting`, confirmed = hidden (parked cars are shown as occupied slots instead).
- Fade: positions older than 60 s at 40% opacity, older than 5 minutes removed.
- Road congestion computed client-side every 5 s: for each segment count vehicles (en_route, speed < 2 m/s or any) within 15 m. Colour: 0–2 `--map-road`, 3–5 `--traffic-medium`, 6+ `--traffic-high`. Thresholds are constants in `features/admin/live/traffic.ts`.
- Clicking a vehicle opens a popover: plate, slot, status, last seen, "Open details" (visit drawer), "Show trail" (last 200 positions from `get_visit_detail`).
- Gate throughput from `get_dashboard_summary.gates` refreshed every 30 s.

## 10. Find my vehicle (walking)

- Uses the walk graph, start = current fix, end = slot centre.
- Shows distance, nearest landmark ("Near Main auditorium"), slot label large, and route.
- Without location permission: show the map fitted to the slot and the landmark text only.

## 11. Performance limits

- Slots: up to 3,000 features render fine as one GeoJSON source. Do not create React markers per slot.
- Update slot colours with `map.setFeatureState({ source: 'slots', id }, { status })` using `promoteId: 'id'` on the source and a `match` on `feature-state` in paint. Do not rebuild the source on every status change.
- Vehicles: one GeoJSON source, `setData` at most once per second.
