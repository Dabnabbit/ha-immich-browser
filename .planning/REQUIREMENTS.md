# Requirements: Immich Browser

**Defined:** 2026-02-19
**Updated:** 2026-02-20 (template overlay applied, scaffold/distribution requirements satisfied)
**Core Value:** Household members can browse their family photo library directly from the HA dashboard without opening a separate app — recent photos, albums, and library stats at a glance.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scaffold & Foundation (Satisfied by Template)

- [x] **SCAF-01**: Integration loads on HA 2025.7+ without deprecation warnings (async static paths, shared aiohttp session) — *Template: async_register_static_paths, async_get_clientsession*
- [x] **SCAF-02**: `manifest.json` passes hassfest validation (`iot_class: local_polling`, `domain: immich_browser`, `unique_id` support) — *Template: correct manifest with dependencies [frontend, http, websocket_api]*
- [x] **SCAF-03**: Config entry has unique_id derived from Immich URL to prevent duplicate entries — *Template: unique_id + _abort_if_unique_id_configured() pattern*
- [x] **SCAF-04**: Domain is `immich_browser` to avoid conflict with official HA Immich integration — *Template: configured during copier copy*

### Configuration

- [ ] **CONF-01**: User can configure Immich server URL and API key with connection validation (GET /api/server/ping)
- [ ] **CONF-02**: Config flow shows clear error for connection refused, invalid API key, or unexpected response

### Sensors

- [ ] **SENS-01**: Photos sensor shows total photo count from Immich server statistics
- [ ] **SENS-02**: Videos sensor shows total video count
- [ ] **SENS-03**: Storage Used sensor shows total storage in GB
- [ ] **SENS-04**: Albums sensor shows total album count
- [ ] **SENS-05**: Stats sensors update via DataUpdateCoordinator polling every 5 minutes
- [ ] **SENS-06**: Albums coordinator polls album list every 10 minutes

### WebSocket Commands

- [ ] **WSCK-01**: `immich_browser/albums` WebSocket command returns album list with metadata
- [ ] **WSCK-02**: `immich_browser/album_assets` WebSocket command returns paginated assets for an album
- [ ] **WSCK-03**: `immich_browser/recent_assets` WebSocket command returns recent photos sorted by date
- [x] **WSCK-04**: WebSocket commands registered in `async_setup` (not `async_setup_entry`) — *Template: async_register_websocket_commands() called in async_setup()*

### Card - Album Browsing

- [ ] **ALBM-01**: Card displays album grid with thumbnail, name, and photo count per album
- [ ] **ALBM-02**: Album thumbnails loaded via fetch + blob URL with x-api-key header
- [ ] **ALBM-03**: User can click album to drill into photo grid view
- [ ] **ALBM-04**: Configurable grid columns (2-4)

### Card - Photo Grid

- [ ] **GRID-01**: Photo grid displays asset thumbnails in responsive grid
- [ ] **GRID-02**: Thumbnails lazy-loaded via IntersectionObserver (only visible images fetched)
- [ ] **GRID-03**: Photo grid supports pagination (50 assets per page, Load More or infinite scroll)
- [ ] **GRID-04**: Video assets show badge overlay to distinguish from photos

### Card - Recent Photos

- [ ] **RCNT-01**: Recent photos view shows most recent N assets (configurable, default 50)
- [ ] **RCNT-02**: User can toggle between Albums and Recent views

### Card - Lightbox

- [ ] **LBOX-01**: Clicking a photo opens lightbox overlay with larger preview
- [ ] **LBOX-02**: Lightbox has close button (click outside or X)
- [ ] **LBOX-03**: Lightbox shows photo date/filename

### Card - Navigation & Chrome

- [ ] **NAVG-01**: Back button navigates from photo grid to album list
- [ ] **NAVG-02**: Stats bar shows photo/video/storage totals
- [ ] **NAVG-03**: Card header with configurable title

### Card - Editor & Performance

- [ ] **PERF-01**: Visual card editor (Immich URL, API key, title, columns, default view)
- [ ] **PERF-02**: Blob URL cache with LRU eviction (max 200) and revokeObjectURL cleanup
- [ ] **PERF-03**: Concurrent thumbnail fetch limited to 6-8 parallel requests
- [ ] **PERF-04**: disconnectedCallback cleans up all blob URLs

### Distribution (Satisfied by Template)

- [x] **DIST-01**: HACS-compatible (hacs.json, manifest.json, correct file structure) — *Template: correct structure*
- [x] **DIST-02**: Frontend card served via integration's async static path registration — *Template: StaticPathConfig in async_setup()*
- [x] **DIST-03**: CI passes hassfest and hacs/action validation — *Template: .github/workflows/validate.yml*

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Browsing

- **BRWS-01**: Search within card (text/CLIP search via Immich API)
- **BRWS-02**: Favorites/ratings display and toggle
- **BRWS-03**: Lightbox navigation (swipe/arrow between photos)
- **BRWS-04**: Pull-to-refresh on mobile/tablet

### Advanced

- **ADVN-01**: Face recognition browsing (people albums)
- **ADVN-02**: Timeline view (chronological scroll)
- **ADVN-03**: Map view (photos by location)
- **ADVN-04**: Video playback in lightbox
- **ADVN-05**: Reconfigure flow to update credentials

## Out of Scope

| Feature | Reason |
|---------|--------|
| Photo upload from HA | Official HA Immich integration handles upload |
| Photo editing/manipulation | Immich handles this natively |
| Face recognition browsing | Complex ML feature, use Immich web UI |
| Sharing/external links | Use Immich web UI for sharing |
| Timeline/map view | Too complex for v1 card, use Immich web UI |
| Video playback in card | Complex (HLS/native video), open in Immich instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 | Template | **Done** |
| SCAF-02 | Template | **Done** |
| SCAF-03 | Template | **Done** |
| SCAF-04 | Template | **Done** |
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| SENS-01 | Phase 1 | Pending |
| SENS-02 | Phase 1 | Pending |
| SENS-03 | Phase 1 | Pending |
| SENS-04 | Phase 1 | Pending |
| SENS-05 | Phase 1 | Pending |
| SENS-06 | Phase 1 | Pending |
| WSCK-01 | Phase 2 | Pending |
| WSCK-02 | Phase 2 | Pending |
| WSCK-03 | Phase 2 | Pending |
| WSCK-04 | Template | **Done** |
| ALBM-01 | Phase 3 | Pending |
| ALBM-02 | Phase 3 | Pending |
| ALBM-03 | Phase 3 | Pending |
| ALBM-04 | Phase 3 | Pending |
| GRID-01 | Phase 4 | Pending |
| GRID-02 | Phase 4 | Pending |
| GRID-03 | Phase 4 | Pending |
| GRID-04 | Phase 4 | Pending |
| RCNT-01 | Phase 4 | Pending |
| RCNT-02 | Phase 4 | Pending |
| LBOX-01 | Phase 4 | Pending |
| LBOX-02 | Phase 4 | Pending |
| LBOX-03 | Phase 4 | Pending |
| NAVG-01 | Phase 3 | Pending |
| NAVG-02 | Phase 3 | Pending |
| NAVG-03 | Phase 3 | Pending |
| PERF-01 | Phase 5 | Pending |
| PERF-02 | Phase 5 | Pending |
| PERF-03 | Phase 5 | Pending |
| PERF-04 | Phase 5 | Pending |
| DIST-01 | Template | **Done** |
| DIST-02 | Template | **Done** |
| DIST-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Satisfied by template: 8 (SCAF-01/02/03/04, DIST-01/02/03, WSCK-04)
- Remaining: 31
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-20 after template overlay*
