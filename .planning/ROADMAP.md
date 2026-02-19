# Roadmap: Immich Browser

## Overview

Immich Browser delivers a photo browsing card for HA in 7 phases: fixing scaffold bugs and establishing the integration foundation, building sensors and the WebSocket data layer, creating the album grid card view, adding photo grid with lazy loading and pagination, adding lightbox preview, adding recent photos view, and packaging for HACS distribution. The card is built incrementally — album grid first (simplest view), then photo grid, then lightbox — each building on the previous. The main technical challenge is authenticated thumbnail loading via blob URLs.

## Phases

- [ ] **Phase 1: Integration Foundation** - Fix scaffold, config flow, API client, coordinators, manifest
- [ ] **Phase 2: Sensors + WebSocket Layer** - Statistics sensors and WebSocket commands for card data
- [ ] **Phase 3: Card - Album Grid** - Basic card with album grid view and blob URL thumbnails
- [ ] **Phase 4: Card - Photo Grid** - Album detail with lazy-loaded photo grid and pagination
- [ ] **Phase 5: Card - Lightbox + Recent** - Lightbox preview, recent photos view, video badges
- [ ] **Phase 6: Card - Editor + Performance** - Visual card editor, stats bar, performance hardening
- [ ] **Phase 7: HACS Distribution** - Packaging, validation, documentation

## Phase Details

### Phase 1: Integration Foundation
**Goal**: Integration loads on HA 2025.7+ with correct domain, manifest, config flow, and data coordinators
**Depends on**: Nothing (first phase)
**Requirements**: SCAF-01, SCAF-02, SCAF-03, SCAF-04, CONF-01, CONF-02, DIST-02
**Success Criteria** (what must be TRUE):
  1. Integration installs and loads without errors on HA 2025.7+
  2. Domain is `immich_browser` (no conflict with official `immich` integration)
  3. Config flow validates Immich server via /api/server/ping
  4. Both coordinators fetch data successfully
  5. Card JS file is served at the registered static path
**Plans**: TBD

Plans:
- [ ] 01-01: Fix scaffold, implement config flow, API client, and coordinators

### Phase 2: Sensors + WebSocket Layer
**Goal**: Statistics sensors visible in HA; WebSocket commands return album and asset data
**Depends on**: Phase 1
**Requirements**: SENS-01, SENS-02, SENS-03, SENS-04, SENS-05, SENS-06, WSCK-01, WSCK-02, WSCK-03, WSCK-04
**Success Criteria** (what must be TRUE):
  1. Photos, Videos, Storage, Albums sensors show correct values
  2. Sensors update on coordinator poll intervals (5min stats, 10min albums)
  3. `immich_browser/albums` WS command returns album list
  4. `immich_browser/album_assets` WS command returns paginated assets
  5. `immich_browser/recent_assets` WS command returns recent photos
**Plans**: TBD

Plans:
- [ ] 02-01: Implement sensor entities for all statistics
- [ ] 02-02: Implement WebSocket commands for album and asset data

### Phase 3: Card - Album Grid
**Goal**: Card displays album grid with authenticated thumbnails using blob URL pattern
**Depends on**: Phase 2
**Requirements**: ALBM-01, ALBM-02, ALBM-03, ALBM-04, NAVG-01, NAVG-02, NAVG-03
**Success Criteria** (what must be TRUE):
  1. Card renders album grid with thumbnail, name, and count per album
  2. Thumbnails load via fetch+blob URL with x-api-key auth
  3. Clicking album transitions to photo grid view (stub initially)
  4. Back navigation works
  5. Stats bar shows photo/video/storage totals
  6. Grid columns are configurable
**Plans**: TBD

Plans:
- [ ] 03-01: Build LitElement card with album grid and blob URL thumbnail loading

### Phase 4: Card - Photo Grid
**Goal**: Album drill-down shows photo grid with lazy loading and pagination
**Depends on**: Phase 3
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Photo grid displays asset thumbnails in responsive grid
  2. Thumbnails lazy-load via IntersectionObserver
  3. Pagination works (Load More loads next 50 assets)
  4. Video assets show video badge overlay
  5. Blob URL LRU cache evicts and revokes old URLs
  6. Concurrent fetches limited to 6-8 parallel
**Plans**: TBD

Plans:
- [ ] 04-01: Implement photo grid with lazy loading, pagination, and memory management

### Phase 5: Card - Lightbox + Recent
**Goal**: Photo lightbox preview and recent photos view complete the core browsing experience
**Depends on**: Phase 4
**Requirements**: LBOX-01, LBOX-02, LBOX-03, RCNT-01, RCNT-02
**Success Criteria** (what must be TRUE):
  1. Clicking photo opens lightbox overlay with larger preview
  2. Lightbox has close button and shows photo date/filename
  3. Recent photos view shows most recent 50 assets
  4. User can toggle between Albums and Recent views
**Plans**: TBD

Plans:
- [ ] 05-01: Implement lightbox preview and recent photos view

### Phase 6: Card - Editor + Performance
**Goal**: Visual card editor and performance hardening for large libraries
**Depends on**: Phase 5
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. Visual card editor allows configuring all settings
  2. Card performs well with 20k+ photo library (no freezing, reasonable memory)
  3. disconnectedCallback properly cleans up all resources
**Plans**: TBD

Plans:
- [ ] 06-01: Build visual card editor and performance testing

### Phase 7: HACS Distribution
**Goal**: Integration is ready for public HACS distribution
**Depends on**: Phase 6
**Requirements**: DIST-01, DIST-03
**Success Criteria** (what must be TRUE):
  1. hassfest CI passes
  2. hacs/action CI passes
  3. Tagged release created on GitHub
  4. Integration installable via HACS custom repository
**Plans**: TBD

Plans:
- [ ] 07-01: HACS packaging, CI validation, and release prep

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Integration Foundation | 0/1 | Not started | - |
| 2. Sensors + WebSocket Layer | 0/2 | Not started | - |
| 3. Card - Album Grid | 0/1 | Not started | - |
| 4. Card - Photo Grid | 0/1 | Not started | - |
| 5. Card - Lightbox + Recent | 0/1 | Not started | - |
| 6. Card - Editor + Performance | 0/1 | Not started | - |
| 7. HACS Distribution | 0/1 | Not started | - |
