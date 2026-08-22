# Wildlife Spot — User Stories & Feature Descriptions

**Epic:** KAN-1 `wildlife-spot` · **Version:** Draft v2 (fresh start) · **Date:** 2026-08-22
**Scope decision:** The product is **wildlife-general**; **whales ship as the first category**. All "whale-specific" wording, schema, and UI are generalised, with whales as the seeded launch content.

---

## 1. Product Overview

Wildlife Spot is a realtime, multiuser sighting registry. Spotters record **what** they saw, **where**, and **when**; every connected user sees new sightings instantly on a shared interactive map. Launch content covers six whale species; the data model is category-driven, so dolphins, seals, seabirds, and other wildlife can be added later **without code changes** — only data.

**Stack:** SpacetimeDB (Rust module) backend · React + TypeScript + Vite frontend · Leaflet map · Browser Geolocation · WebSocket subscriptions.

---

## 2. Epic (revised)

**KAN-1 — wildlife-spot**
> As a wildlife spotter, when I record a sighting of any wildlife, I want to register it on a map so that I can share the sighting with other spotters.

**Epic success looks like:** a new spotter can register, report a located sighting in under a minute, and every other connected spotter sees it on the live map immediately.

---

## 3. Personas

- **Spotter (primary):** a casual wildlife enthusiast on a phone or laptop who reports sightings and browses what others have seen nearby.
- **Curator (future):** maintains the species catalogue and moderates content. Out of scope for v1 but informs the category-driven design.

---

## 4. Story Index

| ID | User Story | Maps to (current Jira) | Status |
|------|------------|------------------------|--------|
| US-01 | Spotter identity & registration | part of KAN-2 | Rewrite |
| US-02 | Species catalogue with categories | new (generalises WhaleSpecies) | Create |
| US-03 | Report a sighting with location | KAN-4 | Rewrite |
| US-04 | Sighting details capture form | KAN-6 | Rewrite |
| US-05 | Submission validation & errors | KAN-7 | Rewrite |
| US-06 | Live sightings map | KAN-5 | Rewrite |
| US-07 | Realtime sharing to all spotters | KAN-3 | Rewrite |
| US-08 | View a shared sighting | KAN-8 | Rewrite |
| US-09 | Edit / delete own sightings | new (backend stubs exist) | Create |
| US-10 | Sighting history list | new (feature exists informally) | Create |

---

## 5. User Stories & Feature Descriptions

### US-01 — Spotter identity & registration
> **As a** new spotter, **I want to** register with a username **so that** my sightings are attributed to me and I can build a history.

**Feature description:** On first visit the spotter picks a unique username. SpacetimeDB issues a cryptographic identity that is stored in the browser, so returning users keep the same identity and sighting history without passwords. The chosen username is displayed on every sighting they report.

**Acceptance criteria:**
- [ ] Username is required and unique; a friendly error is shown if taken
- [ ] Identity token persists across browser sessions
- [ ] Reported sightings display the reporter's username
- [ ] No email/password in v1 — identity = SpacetimeDB token

**Implementation notes:** `user` table exists; `register_user` reducer is a stub and needs the uniqueness check + insert. `LoginForm.tsx` exists.

---

### US-02 — Species catalogue with categories
> **As a** spotter, **I want to** choose the species I saw from an organised catalogue **so that** my report is accurate and consistent with everyone else's.

**Feature description:** Species live in a central database table with common name, scientific name, and a **category**. Whales are the launch category, seeded with Blue, Humpback, Gray, Sperm, Killer, and Minke. Adding a new category (dolphins, seals, seabirds, …) is a data change, not a code change. The UI groups species by category with whales listed first.

**Acceptance criteria:**
- [ ] Species list is loaded from the database, never hardcoded in the UI
- [ ] Every species has a category; the six seeded whales are category `whale`
- [ ] Species are seeded automatically on module init
- [ ] UI filters/groups species by category, whales first
- [ ] Submissions referencing an unknown species id are rejected server-side

**Implementation notes:** Rename `whale_species` → `species` and add a `category` field (enum or string). The `init` reducer is currently empty — seeding belongs there.

---

### US-03 — Report a sighting with location
> **As a** spotter, **I want to** record where I saw the wildlife — by pinning the map or using my device location — **so that** other spotters can find it.

**Feature description:** Two location modes: **"Use my location"** via the browser Geolocation API, or **manual pin** by clicking the map. Coordinates are captured as latitude/longitude and stored with the sighting. Location is mandatory — a sighting without a place is not a sighting.

**Acceptance criteria:**
- [ ] "Use my location" fills coordinates after explicit user consent
- [ ] Graceful fallback with a clear message if geolocation is denied/unavailable
- [ ] Click-to-pin sets or moves the marker; coordinates update live
- [ ] Works on localhost in dev; requires HTTPS in production (browser constraint)

**Implementation notes:** KAN-4 scope. `MapComponent.tsx` + `SightingForm.tsx` exist.

---

### US-04 — Sighting details capture form
> **As a** spotter, **I want to** record the details of what I saw — species, how many, when, and notes — **so that** the sighting is useful to others.

**Feature description:** The report form captures: **species** (from the catalogue, US-02), **individual count** (generalises the whale-only "pod size" — works for a pod of whales or a single seal), **date/time** (defaults to now), and optional **notes** for behaviour, conditions, or context.

**Acceptance criteria:**
- [ ] All fields present with sensible defaults (time = now, count = 1)
- [ ] Count is an integer ≥ 1
- [ ] Notes are optional and length-limited (e.g. 1000 chars)
- [ ] Submit calls `report_sighting` with all values and closes on success

**Implementation notes:** KAN-6 scope. `Sighting` table already has all fields; rename `pod_size` → `count` for generality.

---

### US-05 — Submission validation & errors
> **As a** spotter, **I want** clear feedback when my report is incomplete or invalid **so that** bad data never reaches the shared map.

**Feature description:** Validation runs on both sides. Client-side checks catch missing required fields (location, species) before submit. Server-side reducer checks are the source of truth: species must exist, latitude within ±90, longitude within ±180, count ≥ 1. All errors are human-readable inline messages.

**Acceptance criteria:**
- [ ] Missing location or species blocks submit with an inline message
- [ ] Server rejects out-of-range coordinates and unknown species ids
- [ ] Error messages are user-friendly; no raw errors or stack traces in the UI
- [ ] Server-side validation cannot be bypassed by a crafted client

**Implementation notes:** KAN-7 scope. Reducers are stubs today, so validation lands together with their implementation.

---

### US-06 — Live sightings map
> **As a** spotter, **I want to** see all sightings on an interactive map **so that** I can explore what's been seen around me.

**Feature description:** A Leaflet map renders one marker per sighting. Clicking a marker opens a summary popup (species, count, time, reporter). A sidebar lists recent sightings and stays in sync with the map. Category/species filtering is designed in from the start (whales first) even if v1 ships with a single category.

**Acceptance criteria:**
- [ ] One accurate marker per sighting
- [ ] Marker click shows species, count, time, and reporter
- [ ] Recent-sightings sidebar; clicking a row highlights/focuses its marker
- [ ] Map updates without a reload when sightings change
- [ ] Filter-by-category control present (only `whale` populated in v1)

**Implementation notes:** KAN-5 scope. `MapComponent.tsx` exists with Leaflet.

---

### US-07 — Realtime sharing to all spotters
> **As a** spotter, **I want** sightings reported by others to appear on my map instantly **so that** I'm always looking at the live picture.

**Feature description:** SpacetimeDB subscriptions stream every sighting insert, update, and delete to all connected clients over WebSocket. No refresh, no polling. This is the core sharing mechanic of the epic.

**Acceptance criteria:**
- [ ] A sighting committed by user B appears for connected user A within ~1 second
- [ ] Edits and deletes propagate the same way
- [ ] On reconnect, the client resubscribes and catches up to current state
- [ ] Connection loss is surfaced to the user, not silently swallowed

**Implementation notes:** KAN-3 scope. This is the primary SpacetimeDB value proposition — keep the reducer/subscription design simple.

---

### US-08 — View a shared sighting
> **As a** spotter, **I want to** open a sighting someone shared and see its full details **so that** I can act on it.

**Feature description:** A detail popup or side panel shows everything recorded for a sighting: species, count, date/time, reporter, notes, and coordinates, with a "centre map here" action for navigation.

**Acceptance criteria:**
- [ ] Full details visible for any sighting on the map or in the list
- [ ] Reporter's username is shown
- [ ] "Centre map here" action zooms to the sighting's coordinates

**Implementation notes:** KAN-8 scope. Extends the US-06 marker popup.

---

### US-09 — Edit / delete own sightings
> **As a** spotter, **I want to** correct or remove my own sightings **so that** the shared map stays accurate — and nobody else can touch mine.

**Feature description:** The author of a sighting can edit any of its fields or delete it outright. Ownership is enforced **server-side** by comparing the caller's identity with the sighting's `user_identity`. All clients see the change in realtime via US-07.

**Acceptance criteria:**
- [ ] Edit/delete controls appear only on the current user's own sightings
- [ ] Server rejects edit/delete from any other identity, even a crafted client
- [ ] Changes propagate to all connected clients without reload
- [ ] Deleting removes the marker everywhere immediately

**Implementation notes:** New story. `update_sighting` and `delete_sighting` reducer stubs already exist — they need ownership checks plus the actual logic.

---

### US-10 — Sighting history list
> **As a** spotter, **I want to** browse recent sightings in a list **so that** I can scan activity without panning the map.

**Feature description:** A sidebar list of the most recent sightings, newest first. Each row shows species, count, relative time ("12 min ago"), and reporter. Clicking a row focuses the map on that sighting (US-08 behaviour). The list is subscription-driven, so it always matches the map.

**Acceptance criteria:**
- [ ] Sorted newest first, capped (e.g. 50) for performance
- [ ] Row shows species, count, relative time, reporter
- [ ] Clicking a row focuses the map on that sighting
- [ ] List stays in sync with the map via the same subscription

**Implementation notes:** New story — the feature informally exists; this formalises and caps it.

---

## 6. Data Model Changes (whale-specific → wildlife-general)

| Current | Proposed | Change |
|---|---|---|
| `whale_species` table | `species` table | Rename; add `category` field (whale, dolphin, seal, seabird, other) |
| 6 hardcoded whale species | Seeded via `init` reducer | Same 6 whales, category `whale` |
| `Sighting.pod_size` | `Sighting.count` | Rename — generic individual count |
| `user`, `sighting` tables | unchanged | — |

---

## 7. Suggested Jira Updates

1. **Update KAN-1** description to the revised epic statement (§2).
2. **Rewrite KAN-2–KAN-8** descriptions from US-01, US-03–US-08 (see Story Index mapping), replacing "whale" wording with "wildlife/species".
3. **Create** three new stories: US-02 (species catalogue), US-09 (edit/delete own sightings), US-10 (sighting history list) — link all to KAN-1.
4. Consider renaming visible "Whale Spotting" branding in the app to "Wildlife Spot" as part of US-06.

---

## 8. Out of Scope for v1

- Photo/video attachments on sightings
- Moderation, reporting, or content curation
- Privacy controls / private sightings
- Offline capture with later sync
- Native mobile apps
- Non-map views (stats, leaderboards, heatmaps)
