# 01. Product Requirements

## 1. Problem

During large college events, hundreds to a few thousand vehicles arrive in a short window. Volunteers direct traffic by hand, slots are not tracked, guests circle the campus, VIP and accessible spaces get taken, and nobody knows how full each area is. After the event there is no record of what happened.

## 2. Goal

A web app (installable PWA, no app store) that:

1. Checks a vehicle in at the gate in under 45 seconds using a photo read by AI.
2. Assigns a free slot that matches the vehicle type and visitor category.
3. Sends the driver a WhatsApp link that opens a live map with directions to the slot, with no signup.
4. Lets the zone volunteer confirm the vehicle is parked in the right place.
5. Gives the admin a live view of every slot, every moving vehicle, and every alert.
6. Produces occupancy, peak hour, revenue, and vehicle count reports with Excel and PDF export.

### Success metrics (per event)

| Metric | Target |
|---|---|
| Median gate check-in time (photo to WhatsApp sent) | 45 s or less |
| Gemini plate read accepted without edit | 80% or more |
| WhatsApp delivered | 95% or more |
| Vehicles confirmed by zone volunteer | 95% or more of checked-in vehicles |
| Wrong-slot alerts resolved within 10 minutes | 90% or more |

## 3. Users and roles

There are four roles. Three are staff; one is the driver.

| Role | `app_role` value | Device | Logs in with | Can do |
|---|---|---|---|---|
| Admin | `admin` | Laptop, sometimes phone | Username + password | Everything: events, map editor, zones, slots, staff, live dashboard, alerts, reports, AI assistant, settings |
| Gate volunteer | `gate_volunteer` | Phone | Username + password | Check in vehicles, assign slots, resend links, reassign, mark exit, search vehicles |
| Zone volunteer | `zone_volunteer` | Phone | Username + password | See vehicles assigned to their zone(s), confirm parked, flag wrong slot or not arrived, report wrong parking, mark exit |
| Driver | `driver` | Own phone | WhatsApp magic link (token). Re-login by entering phone number, which resends the link on WhatsApp | See slot, map, live navigation, mark as parked, find my vehicle, SOS |

The user management feature (F-ADM-06) manages the three staff roles. Drivers are created automatically at check-in.

## 4. Full flow

```
 GATE                         DRIVER PHONE                     ZONE                     ADMIN
 ─────                        ────────────                     ────                     ─────
 1 Vehicle arrives with
   event pass card
 2 Volunteer photographs
   car + card
 3 Gemini reads plate,
   type, colour, card
 4 Volunteer checks fields
 5 Enters driver phone
 6 Picks a suggested slot
 7 Assign + WhatsApp  ───────▶ 8 WhatsApp message
                                 with link /d/<token>
                               9 Taps link, auto login
                              10 Allows location
                              11 Sees slot on map,
                                 starts navigation  ───────────────────────────────▶ live position
                              12 Arrives, taps
                                 "Mark as parked"   ──────▶ 13 Vehicle appears in
                                                              "Waiting for you"
                                                           14 Volunteer checks car,
                                                              taps "Confirm"  ──────▶ slot = occupied
                              15 Page switches to
                                 "Find my vehicle"
 16 On leaving, gate or zone
    volunteer marks exit  ──────────────────────────────────────────────────────────▶ slot = available
```

Branches that must work:

- Driver never opens the link. Zone volunteer can still confirm when the car arrives.
- Driver parks in a different slot. Zone volunteer taps "Wrong slot", picks the actual slot. A wrong-parking alert is raised.
- Driver taps "Mark as parked" far from the slot. System raises a location mismatch alert.
- WhatsApp fails. Gate screen shows a QR code of the same link for the driver to scan.
- Driver loses the link or logs out. Driver enters phone number on the login page; the link is resent on WhatsApp.
- Slot is taken or blocked while assigning. Assignment fails cleanly and the next suggestion is offered.
- Admin or gate volunteer reassigns a vehicle. Driver gets a new WhatsApp message and the open driver page updates live.

## 5. Features

Priority: P0 = required for first event. P1 = required but can ship a week later. All features below are in scope. Nothing else is.

### 5.1 Gate (gate volunteer)

| ID | Feature | Priority |
|---|---|---|
| F-GATE-01 | Capture vehicle photo with phone camera (car and pass card in one frame, or two photos) | P0 |
| F-GATE-02 | AI extraction with Gemini: plate number, vehicle type, colour, make, pass card category, pass number, holder name, with confidence | P0 |
| F-GATE-03 | Review and edit extracted details. Plate format validation for Indian plates | P0 |
| F-GATE-04 | Duplicate check: warn if the plate already has an active visit | P0 |
| F-GATE-05 | Driver phone entry (+91), optional name, language choice (English or Malayalam) | P0 |
| F-GATE-06 | Slot suggestion: ranked free slots that match vehicle type, category, accessible need, closest to this gate | P0 |
| F-GATE-07 | Pick slot on a map as an alternative to the suggestion list | P0 |
| F-GATE-08 | Assign slot and send WhatsApp in one action | P0 |
| F-GATE-09 | Done screen with WhatsApp delivery state and QR code fallback of the driver link | P0 |
| F-GATE-10 | Parking fee entry (amount, cash/UPI/free) when the event has paid parking enabled | P1 |
| F-GATE-11 | Exit: find vehicle by plate search or photo, mark exited | P0 |
| F-GATE-12 | Search vehicles, resend link, reassign slot, cancel visit | P0 |

### 5.2 Driver

| ID | Feature | Priority |
|---|---|---|
| F-DRV-01 | Token login from WhatsApp link, session valid until event end + 6 hours | P0 |
| F-DRV-02 | Re-login by phone number: link resent on WhatsApp | P0 |
| F-DRV-03 | Location permission screen with plain explanation | P0 |
| F-DRV-04 | Slot overview: slot label, zone, vehicle, map with slot highlighted | P0 |
| F-DRV-05 | Interactive map with live location and turn-by-turn directions on the campus road network, respecting one-way roads | P0 |
| F-DRV-06 | Live location sharing while navigating (visible to admin) | P0 |
| F-DRV-07 | Mark as parked | P0 |
| F-DRV-08 | Find my vehicle: walking directions back to the slot, nearest landmark | P0 |
| F-DRV-09 | SOS: send alert with location and reason, call event emergency number | P0 |
| F-DRV-10 | Live update when slot is reassigned | P0 |
| F-DRV-11 | English and Malayalam, switchable any time | P0 |
| F-DRV-12 | Logout | P0 |

### 5.3 Zone volunteer

| ID | Feature | Priority |
|---|---|---|
| F-ZONE-01 | List of vehicles in my zone(s) by status: Coming, Waiting for you, Parked | P0 |
| F-ZONE-02 | Zone map with slot statuses | P0 |
| F-ZONE-03 | Confirm parked (with or without driver's "Mark as parked") | P0 |
| F-ZONE-04 | Wrong slot: pick the slot the car is actually in | P0 |
| F-ZONE-05 | Not here: flag a vehicle that has not arrived | P1 |
| F-ZONE-06 | Report wrong parking (blocking road, no-parking area) with photo and location | P0 |
| F-ZONE-07 | Mark exit | P1 |
| F-ZONE-08 | Search by plate in my zone | P0 |

### 5.4 Admin

| ID | Feature | Priority | PRD list ref |
|---|---|---|---|
| F-ADM-01 | Live dashboard: counts, zone occupancy, live map, alerts, activity feed | P0 | 72 |
| F-ADM-02 | Live traffic map: moving vehicles, road congestion, gate throughput | P0 | 72 |
| F-ADM-03 | Events: create, edit, set live, close | P0 | |
| F-ADM-04 | Vehicles table with filters, detail drawer, timeline, actions | P0 | |
| F-ADM-05 | Alerts inbox: SOS, wrong slot, location mismatch, wrong parking, timeouts | P0 | 68, 69 |
| F-ADM-06 | Staff management: create, edit, deactivate, reset password, assign zones or gates | P0 | 71 |
| F-ADM-07 | Settings: fees, timeouts, tolerances, emergency contacts, WhatsApp test | P0 | |
| F-ADM-08 | AI assistant (admin only) that answers questions from live data | P1 | 70 |

### 5.5 Map and zones

| ID | Feature | Priority | PRD list ref |
|---|---|---|---|
| F-MAP-01 | Map editor on satellite or street base map | P0 | 73 |
| F-MAP-02 | Draw zones as polygons with name, code, colour | P0 | 74 |
| F-MAP-03 | Zone rules: allowed vehicle types, allowed visitor categories, overflow flag, priority | P0 | 75, 76 |
| F-MAP-04 | Slot row generator: draw a line, set count, size, angle, labels | P0 | 76 |
| F-MAP-05 | Single slot draw, move, rotate, delete | P0 | |
| F-MAP-06 | Slot properties: vehicle type, accessible, EV charger, blocked | P0 | 76, 77 |
| F-MAP-07 | Road network drawing with two-way and one-way roads | P0 | 73 |
| F-MAP-08 | Gates (entry, exit, both) and landmarks | P0 | |
| F-MAP-09 | Custom campus image overlay (drone photo or site plan) | P1 | |
| F-MAP-10 | Zones and slots tables for bulk edits (block, unblock, type) | P0 | 74 |

### 5.6 Reports

| ID | Feature | Priority | PRD list ref |
|---|---|---|---|
| F-RPT-01 | Occupancy report by zone over time | P1 | 63 |
| F-RPT-02 | Peak hour analysis: arrivals and exits per 15 minutes | P1 | 64 |
| F-RPT-03 | Revenue by zone, day, payment method | P1 | 65 |
| F-RPT-04 | Vehicle counts by category and type | P1 | 66 |
| F-RPT-05 | Export Excel (all sheets) and PDF summary | P1 | 67 |

### 5.7 Cross-cutting

| ID | Feature | Priority | PRD list ref |
|---|---|---|---|
| F-WA-01 | WhatsApp Cloud API: templates, sending, delivery status webhook, inbound auto-reply | P0 | |
| F-I18N-01 | English and Malayalam across driver, gate, and zone screens. Admin in English with Malayalam available | P0 | 78 |
| F-ALERT-01 | Automatic alerts: not arrived, confirmation pending, location mismatch, overstay | P0 | 69 |
| F-PWA-01 | Installable PWA for staff, screen wake lock during navigation | P1 | |
| F-AUDIT-01 | Every visit state change recorded in `visit_events` | P0 | |

## 6. Acceptance criteria (per feature group)

### Gate
- Photo upload and AI result shows in under 6 seconds on 4G for a 1280 px JPEG. If Gemini takes more than 12 seconds or fails, the form opens empty with a notice and the volunteer types manually.
- Plate input normalises to uppercase without spaces. Invalid format shows an inline warning but does not block submit (old and unusual plates exist).
- If the plate has an active visit, a warning shows the existing slot with buttons "Open existing" and "Continue anyway". "Continue anyway" is available to admin only.
- Suggestions load in under 1 second and show at most 5 slots. Selecting and assigning a slot that was taken in the meantime shows "That slot was just taken" and refreshes suggestions.
- After "Assign and send", the done screen shows within 3 seconds. WhatsApp state updates live: Sending, Sent, Delivered, Read, Failed.
- QR code is always visible on the done screen (not only on failure), smaller when WhatsApp is sent.

### Driver
- Opening a valid link logs in without any input. An expired or revoked link shows the phone login screen.
- The phone login always shows the same confirmation message whether or not the number exists.
- Route draws within 2 seconds of receiving the first GPS fix. Off-route for 2 consecutive fixes more than 25 m from the route triggers a reroute.
- Within 20 m of the slot, a "You have arrived" sheet appears with "Mark as parked".
- After confirmation by the zone volunteer, the screen switches to "Find my vehicle" and location sharing stops.
- SOS reaches the admin dashboard within 3 seconds and WhatsApp to admin alert numbers within 15 seconds.

### Zone volunteer
- New vehicles appear in the list without refresh within 2 seconds of assignment.
- Confirm works for statuses `assigned`, `en_route`, `driver_parked`.
- Wrong slot shows only slots in the volunteer's zones that are `available` or the currently assigned slot.

### Admin
- Dashboard counts match the database within 2 seconds of any change.
- Live map shows every vehicle with a position fix from the last 60 seconds. Older positions fade, then hide after 5 minutes.
- Map editor prevents saving slots that are outside their zone or overlap another slot by more than 10% of area.
- Deleting a zone or slot that has an active visit is blocked with a message naming the plate.

### Reports
- All numbers in reports reconcile with the vehicles table for the same filters.
- Excel export has one sheet per report plus a raw "Vehicles" sheet.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Scale | 3,000 visits per event, 300 slots per zone, 60 concurrent navigating drivers, 20 staff devices |
| Performance | First load of driver page under 3 s on 4G (map tiles excluded). JS bundle for driver route under 350 KB gzip, map library loaded lazily |
| Availability | Staff screens show a clear offline banner and retry. No offline queue in v1 |
| Security | RLS on every table. Tokens stored hashed. Phone numbers visible only to admin and gate volunteers |
| Privacy | Location is shared only after explicit consent, only while the visit is active and not yet confirmed. Positions purged 7 days after event close. Photos purged 30 days after event close |
| Accessibility | WCAG 2.1 AA contrast, 48 px touch targets on mobile screens, no information by colour alone |
| Browsers | Chrome Android 110+, Safari iOS 16.4+, desktop Chrome, Edge, Safari, Firefox current |
| Languages | English, Malayalam |

## 8. Decisions already made

These are fixed. Do not revisit them in code.

1. **One app, role-based routes.** Driver, gate, zone, and admin are routes in one Vite app, not separate apps.
2. **No native app.** PWA only. Background location when the screen is off is not possible in a browser; the driver screen keeps the screen awake with the Wake Lock API and asks the driver to keep the page open.
3. **"Card" means the event pass card** the driver carries (VIP, guest, faculty, and so on). Gemini reads it if visible in the photo to prefill the category. If there is no card, the volunteer picks the category.
4. **Driver re-login is link resend, not OTP.** The driver enters their phone number and receives a fresh link on WhatsApp. This proves phone ownership without an OTP screen.
5. **Staff log in with username + password.** Internally the username maps to `<username>@staff.eventpark.local` in Supabase Auth. No email is sent to staff.
6. **Drivers are Supabase Auth users** with a synthetic email `d_<driver_id>@drivers.eventpark.local`. The token link is exchanged for a real Supabase session via a server-generated magic link hash.
7. **Maps are MapLibre GL JS** with OpenFreeMap street tiles (free, no key) and optional MapTiler satellite (free tier key). No Google Maps.
8. **Routing is computed in the browser** on the campus road graph drawn by the admin. No external routing API. Navigation outside the campus is out of scope.
9. **Slot status `occupied` starts when the driver marks parked or the volunteer confirms**, whichever is first. `confirmed` on the visit is the only proof of correct parking.
10. **One live event at a time.** Staff accounts are reused across events.
11. **Revenue is recorded, not collected.** The app records the fee and method; money is handled at the gate. No payment gateway.
12. **AI assistant is read-only.** It can query data through fixed tools. It cannot change anything.
13. **PDF exports are English only** (jsPDF cannot shape Malayalam). Excel exports keep Malayalam text as is.
14. **Light theme only in v1.**
15. **Location accuracy:** phone GPS is 5 to 20 m. The system never claims to know the exact slot from GPS. Location mismatch uses a tolerance (default 40 m) from the slot polygon.

## 9. Out of scope

Pre-booking by drivers, payment gateway, number plate cameras (ANPR), boom barriers, IoT sensors, LED boards, kiosks, parking outside the campus, navigation from the driver's home to the campus, voice assistant, chatbot for drivers, dark mode, offline queue, multiple simultaneous live events, native apps.

## 10. Glossary

| Term | Meaning |
|---|---|
| Event | One college event with a start and end time and its own map |
| Zone | A polygon area with rules (vehicle types, categories). Contains slots |
| Slot | One parking bay polygon with a label like `A-012` |
| Visit | One vehicle's stay: from gate check-in to exit |
| Gate | An entry and/or exit point on the map |
| Road network | Lines drawn by the admin used for routing. Each segment is two-way or one-way |
| Landmark | A named point (auditorium, help desk, first aid) used in directions and find my vehicle |
| Pass card | The physical event card the driver shows at the gate |
