# Roadmap: Immich Browser

## Overview

Immich Browser delivers a photo browsing card for HA in 5 phases. The ha-hacs-template v1.0 overlay provides the scaffold, CI/CD, test framework, WebSocket framework, and dual coordinator setup — eliminating the original Phase 1 (scaffold fixes) and Phase 7 (HACS distribution). The remaining work is Immich-specific: API client + data layer, WebSocket commands, card (album grid → photo grid → lightbox), and final validation. The card is built incrementally — album grid first, then photo grid with pagination, then lightbox and recent view. The main technical challenge is authenticated thumbnail loading via blob URLs.

## Template Baseline (Satisfied by ha-hacs-template v1.0)

The following requirements are satisfied by the template overlay and do not need dedicated phases:

| Requirement | What the Template Provides |
|-------------|---------------------------|
| SCAF-01 | `async_register_static_paths` + `StaticPathConfig` (HA 2025.7+) |
| SCAF-02 | Valid manifest.json with `iot_class`, `version`, `dependencies: [frontend, http, websocket_api]` |
| SCAF-03 | `unique_id` + `_abort_if_unique_id_configured()` pattern |
| SCAF-04 | Domain set to `immich_browser` during copier copy |
| DIST-01 | HACS-compatible file structure (hacs.json, manifest.json) |
| DIST-02 | Frontend card served via async static path registration |
| DIST-03 | CI workflows (hassfest + hacs/action) in `.github/workflows/validate.yml` |
| WSCK-04 | WebSocket commands registered in `async_setup` (domain-scoped) |

## Phases

- [ ] **Phase 1: API Client + Data Layer** — Immich API client, dual coordinators, config flow, sensors
- [ ] **Phase 2: WebSocket Commands** — Album list, album assets (paginated), recent assets
- [ ] **Phase 3: Card - Album Grid** — Album grid with blob URL thumbnails, stats bar, navigation
- [ ] **Phase 4: Card - Photo Grid + Lightbox + Recent** — Photo grid, lazy loading, pagination, lightbox, recent view, video badges
- [ ] **Phase 5: Card - Editor + Performance + Validation** — Visual editor, LRU cache, concurrent limits, tests, CI

## Phase Details

### Phase 1: API Client + Data Layer
**Goal**: Integration connects to Immich, polls stats and albums via dual coordinators, exposes 4 sensors
**Depends on**: Template overlay (done)
**Requirements**: CONF-01, CONF-02, SENS-01, SENS-02, SENS-03, SENS-04, SENS-05, SENS-06
**Files to customize**:
  - `const.py` — Immich-specific constants (CONF_IMMICH_URL, API_HEADER, intervals)
  - `api.py` — ImmichClient wrapping /api/server/ping, /api/server/statistics, /api/albums, /api/albums/{id}, /api/search/metadata, thumbnail URLs
  - `coordinator.py` — ImmichStatsCoordinator polling /api/server/statistics (5min)
  - `coordinator_secondary.py` — ImmichAlbumsCoordinator polling /api/albums (10min)
  - `config_flow.py` — Immich URL + API key, validate via /api/server/ping with x-api-key header
  - `sensor.py` — 4 sensors: photos, videos, storage (GB), albums
  - `strings.json` + `translations/en.json` — Immich-specific wording
  - `__init__.py` — Wire both coordinators + client into runtime_data
**Success Criteria**:
  1. Config flow validates connection to Immich via GET /api/server/ping
  2. Stats sensors (photos, videos, storage, albums) show correct values
  3. Both coordinators poll at correct intervals (5min stats, 10min albums)
  4. hassfest validation passes

Plans:
- [ ] 01-01: Customize api.py, coordinators, config_flow, sensor.py, const.py for Immich API

### Phase 2: WebSocket Commands
**Goal**: WebSocket commands return album and asset data for the card to consume
**Depends on**: Phase 1
**Requirements**: WSCK-01, WSCK-02, WSCK-03
**Files to customize**:
  - `websocket.py` — 3 commands: albums, album_assets (paginated), recent_assets
**Success Criteria**:
  1. `immich_browser/albums` returns album list from coordinator
  2. `immich_browser/album_assets` returns paginated assets for an album
  3. `immich_browser/recent_assets` returns recent photos sorted by date

Plans:
- [ ] 02-01: Implement 3 WebSocket commands for album and asset data

### Phase 3: Card - Album Grid
**Goal**: Card displays album grid with authenticated thumbnails using blob URL pattern
**Depends on**: Phase 2
**Requirements**: ALBM-01, ALBM-02, ALBM-03, ALBM-04, NAVG-01, NAVG-02, NAVG-03
**Pre-phase research**: CORS behavior with default Immich Docker must be verified
**Files to customize**:
  - `frontend/immich_browser-card.js` — Album grid view, blob URL thumbnail loading, stats bar, navigation chrome
**Success Criteria**:
  1. Card renders album grid with thumbnail, name, and count per album
  2. Thumbnails load via fetch+blob URL with x-api-key auth
  3. Clicking album transitions to photo grid view (stub)
  4. Stats bar shows photo/video/storage totals
  5. Grid columns configurable

Plans:
- [ ] 03-01: Build album grid card view with blob URL thumbnail loading

### Phase 4: Card - Photo Grid + Lightbox + Recent
**Goal**: Complete browsing experience with photo grid, lightbox, recent view, and lazy loading
**Depends on**: Phase 3
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, LBOX-01, LBOX-02, LBOX-03, RCNT-01, RCNT-02
**Success Criteria**:
  1. Photo grid displays thumbnails with lazy loading via IntersectionObserver
  2. Pagination works (Load More loads next 50 assets)
  3. Video assets show badge overlay
  4. Lightbox opens on photo click with close button and metadata
  5. Recent photos view shows most recent 50 assets
  6. User can toggle between Albums and Recent views

Plans:
- [ ] 04-01: Implement photo grid with lazy loading and pagination
- [ ] 04-02: Implement lightbox preview and recent photos view

### Phase 5: Card - Editor + Performance + Validation
**Goal**: Visual editor, performance hardening, tests, and CI validation
**Depends on**: Phase 4
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria**:
  1. Visual card editor configures all settings (URL, API key, title, columns, default view)
  2. Blob URL LRU cache (200 max) with revokeObjectURL cleanup
  3. Concurrent thumbnail fetch limited to 6-8 parallel
  4. disconnectedCallback cleans up all blob URLs
  5. All tests pass, hassfest + hacs/action CI passes
  6. README documents installation, configuration, card usage

Plans:
- [ ] 05-01: Build visual card editor and implement LRU cache + concurrent fetch limits
- [ ] 05-02: Update tests for Immich-specific logic and validate CI

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. API Client + Data Layer | 0/1 | Not started | - |
| 2. WebSocket Commands | 0/1 | Not started | - |
| 3. Card - Album Grid | 0/1 | Not started | - |
| 4. Card - Photo Grid + Lightbox + Recent | 0/2 | Not started | - |
| 5. Card - Editor + Performance + Validation | 0/2 | Not started | - |
