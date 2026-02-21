# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Browse family photo library directly from the HA dashboard — albums, recent photos, and stats at a glance
**Current focus:** Template applied. Ready to customize for Immich API.

## Current Position

Phase: 1 of 5 (API Client + Data Layer)
Plan: 0 of 1 in current phase
Status: Ready to plan
Last activity: 2026-02-20 — ha-hacs-template v1.0 overlay applied via copier copy

Progress: [█░░░░░░░░░] 15% (scaffold + distribution satisfied by template)

## What the Template Provides (Already Done)

The ha-hacs-template v1.0 overlay (with `use_websocket=true`, `use_secondary_coordinator=true`) satisfies:

- **SCAF-01**: Modern `async_register_static_paths` + `StaticPathConfig` (HA 2025.7+)
- **SCAF-02**: Valid `manifest.json` with `iot_class`, `version`, `dependencies: [frontend, http, websocket_api]`
- **SCAF-03**: `unique_id` from host:port with `_abort_if_unique_id_configured()`
- **SCAF-04**: Domain set to `immich_browser` (configured during copier copy)
- **DIST-01**: HACS-compatible structure (hacs.json, manifest.json, file layout)
- **DIST-02**: Frontend card served via async static path registration
- **DIST-03**: CI workflows (hassfest + hacs/action) in `.github/workflows/validate.yml`
- **WSCK-04**: WebSocket commands registered in `async_setup` (domain-scoped)

Also provides correct patterns for:
- Shared aiohttp session via `async_get_clientsession(hass)`
- `ConfigEntry.runtime_data` typed dataclass
- `CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)`
- Primary + secondary `DataUpdateCoordinator` setup
- `CoordinatorEntity` sensor base class
- WebSocket command handler framework
- Test scaffold (conftest, config_flow tests, coordinator tests, websocket tests)
- Options flow

## What Needs Customization (File-by-File)

### const.py
- Change `DEFAULT_PORT` from 8080 → remove (Immich uses full URL, not host:port)
- Add `CONF_IMMICH_URL = "immich_url"` (replaces CONF_HOST + CONF_PORT)
- Keep `DEFAULT_SCAN_INTERVAL = 300` (5 min for stats) — correct as-is
- Change `DEFAULT_SECONDARY_SCAN_INTERVAL` to 600 (10 min for albums)
- Add `API_HEADER = "x-api-key"` for Immich auth pattern

### api.py
- Replace generic `ApiClient` → `ImmichClient`
- Auth: `x-api-key` header (not Bearer token)
- Replace `/health` → `GET /api/server/ping` (expects `{"res": "pong"}`)
- Replace `/api/data` → `GET /api/server/statistics` for stats
- Add `async_get_albums()` → `GET /api/albums`
- Add `async_get_album_assets(album_id)` → `GET /api/albums/{id}`
- Add `async_get_recent_assets(count)` → `POST /api/search/metadata` (note: POST not GET)
- Build URL: `{immich_url}/api/assets/{id}/thumbnail` for thumbnail URLs

### config_flow.py
- Replace `CONF_HOST` + `CONF_PORT` → single `CONF_IMMICH_URL` field (full URL like `http://192.168.1.50:2283`)
- Replace `CONF_API_KEY` → use `x-api-key` header convention
- Validate via `GET /api/server/ping` with `x-api-key` header
- `unique_id` from normalized Immich URL (strip trailing slash)
- Update schema: `{vol.Required(CONF_IMMICH_URL): str, vol.Required(CONF_API_KEY): str}`

### coordinator.py (Primary — Stats)
- Rename class to `ImmichStatsCoordinator`
- `_async_update_data()` calls `GET /api/server/statistics`
- Returns `{photos: int, videos: int, usage_bytes: int}` aggregated from usageByUser array

### coordinator_secondary.py (Albums)
- Rename class to `ImmichAlbumsCoordinator`
- `_async_update_data()` calls `GET /api/albums`
- Returns album list: `[{id, name, count, thumbnail_id}]`
- Update interval to 600s (10 min)

### sensor.py
- Replace single generic sensor with 4 sensors:
  - `ImmichPhotosSensor`: state = photos count, icon = mdi:image-multiple
  - `ImmichVideosSensor`: state = videos count, icon = mdi:video-outline
  - `ImmichStorageSensor`: state = storage GB (bytes→GB), unit = GB, icon = mdi:harddisk
  - `ImmichAlbumsSensor`: state = album count, icon = mdi:folder-multiple-image

### websocket.py
- Replace generic `get_data` command with 3 Immich-specific commands:
  - `immich_browser/albums`: Returns album list from albums coordinator
  - `immich_browser/album_assets`: Takes `album_id`, `page`, `per_page`; returns paginated assets
  - `immich_browser/recent_assets`: Takes `count`; calls POST /api/search/metadata

### frontend/immich_browser-card.js
- Complete rewrite: Album grid → Photo grid → Lightbox state machine
- Blob URL pattern: `fetch(thumbnail_url, {headers: {"x-api-key": key}})` → `createObjectURL(blob)`
- LRU cache (200 max) with `revokeObjectURL` cleanup
- Concurrent fetch limiter (6-8 parallel)
- IntersectionObserver for lazy loading (root = shadow DOM container)
- Card editor with Immich URL, API key, header, columns, default view

### strings.json + translations/en.json
- Update step title: "Connect to Immich Server"
- Replace host/port fields with `immich_url` field
- API key description for Immich context

### __init__.py
- Update runtime_data dataclass to hold both coordinators + API client
- Wire up both coordinators in `async_setup_entry`

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Domain is `immich_browser` (not `immich`) to avoid official integration conflict
- [Init]: Blob URLs for thumbnails (fetch+createObjectURL) — API key in card config
- [Init]: Two coordinators: stats (5min) and albums (10min) with different intervals
- [Init]: WebSocket commands for album/asset data (sensor attributes too limited)
- [Init]: LRU cache (200 max) with revokeObjectURL cleanup
- [Init]: CORS with Immich needs live testing before card phase
- [Template]: Re-scaffolded from ha-hacs-template v1.0 (2026-02-20)

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: CORS behavior with default Immich Docker is unverified — must test before card phase planning

## Session Continuity

Last session: 2026-02-20
Stopped at: Template overlay complete, docs updated with customization guide
Resume action: Start Phase 1 — customize api.py, coordinators, config_flow, sensors for Immich API
