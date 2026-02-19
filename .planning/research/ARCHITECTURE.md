# Architecture Research

**Domain:** Home Assistant HACS integration architecture for Immich photo browsing
**Researched:** 2026-02-19
**Confidence:** HIGH (HA patterns), MEDIUM (Immich API specifics)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Home Assistant                               │
│                                                                      │
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────────┐│
│  │  Config Flow  │  │ Stats Coord.    │  │ Albums Coord.           ││
│  │              │  │ (5min poll)     │  │ (10min poll)            ││
│  │  url/api_key │  │                 │  │                         ││
│  │              │  │ /server/stats   │  │ /albums                 ││
│  └──────┬───────┘  └────────┬────────┘  └────────┬────────────────┘│
│         │                   │                     │                  │
│         │          ┌────────┼─────────┐           │                  │
│         ▼          ▼        ▼         ▼           │                  │
│  ┌────────────┐ ┌──────┐ ┌──────┐ ┌────────┐     │                  │
│  │ __init__.py │ │Photos│ │Videos│ │Storage │     │                  │
│  │            │ │Sensor│ │Sensor│ │Sensor  │     │                  │
│  │ - WS cmds  │ └──────┘ └──────┘ └────────┘     │                  │
│  │ - static   │                    ┌────────┐     │                  │
│  │   path     │                    │Albums  │◄────┘                  │
│  └──────┬─────┘                    │Sensor  │                        │
│         │                          └────────┘                        │
│  ┌──────▼────────────────────────────────────────────────────────┐  │
│  │              Lovelace Card (LitElement)                        │  │
│  │                                                                │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  📷 19,925 photos · 234 videos · 156 GB                │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  [Albums ▾] [Recent ▾]                                  │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │  │  │
│  │  │  │ Album 1 │ │ Album 2 │ │ Album 3 │ │ Album 4 │     │  │  │
│  │  │  │  thumb  │ │  thumb  │ │  thumb  │ │  thumb  │     │  │  │
│  │  │  │ 42 pics │ │ 128 pics│ │ 15 pics │ │ 67 pics │     │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  │                                                                │  │
│  │  callWS("immich_browser/albums") → album data from coordinator │  │
│  │  fetch(immich_url + "/api/assets/{id}/thumbnail",              │  │
│  │        {headers: {"x-api-key": api_key}})                      │  │
│  │     → blob → URL.createObjectURL(blob) → <img src="blob:..."> │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP (aiohttp)
                               ▼
                    ┌──────────────────────┐
                    │   Immich Server      │
                    │   (Docker, port 2283)│
                    │                      │
                    │   /api/server/ping   │
                    │   /api/server/stats  │
                    │   /api/albums        │
                    │   /api/albums/{id}   │
                    │   /api/assets/{id}/  │
                    │     thumbnail        │
                    │   /api/search/       │
                    │     metadata         │
                    └──────────────────────┘
```

## Component Design

### 1. Config Flow (`config_flow.py`)

**Single step:**
- URL: Full Immich URL (e.g., `http://192.168.50.250:2283`)
- API Key: Immich API key (required)

**Validation:**
- GET `{url}/api/server/ping` with `x-api-key: {api_key}` header
- Expect: `{"res": "pong"}` with 200 status
- If connection refused → "Cannot connect to Immich server"
- If 401 → "Invalid API key"

**Entry data structure:**
```python
{
    "url": "http://192.168.50.250:2283",
    "api_key": "abc123...",
}
```

**runtime_data pattern:**
```python
type ImmichBrowserConfigEntry = ConfigEntry[ImmichBrowserData]

@dataclass
class ImmichBrowserData:
    stats_coordinator: ImmichStatsCoordinator
    albums_coordinator: ImmichAlbumsCoordinator
    client: ImmichClient
```

### 2. API Client (`api.py`)

```python
class ImmichClient:
    def __init__(self, session: ClientSession, url: str, api_key: str):
        self._session = session
        self._url = url.rstrip("/")
        self._headers = {"x-api-key": api_key}

    async def ping(self) -> bool:
        """GET /api/server/ping → True if pong"""

    async def get_statistics(self) -> dict:
        """GET /api/server/statistics → {photos, videos, usage}"""

    async def get_albums(self) -> list[dict]:
        """GET /api/albums → [{id, albumName, albumThumbnailAssetId, assetCount, ...}]"""

    async def get_album_assets(self, album_id: str, page: int = 1, size: int = 50) -> list[dict]:
        """GET /api/albums/{id} → assets list (paginated)"""

    async def get_recent_assets(self, page: int = 1, size: int = 50) -> list[dict]:
        """POST /api/search/metadata → recent assets sorted by date desc"""

    async def validate_connection(self) -> bool:
        """Ping server to validate connection."""
```

**Key notes:**
- Session from `async_get_clientsession(hass)` — never create own
- All requests include `x-api-key` header
- URL normalization: strip trailing slash, ensure no double-slash in paths
- Timeout: 10s for metadata, 30s for asset lists (can be large)

### 3. DataUpdateCoordinators (`coordinator.py`)

**Stats Coordinator:**
```python
class ImmichStatsCoordinator(DataUpdateCoordinator):
    """Polls /api/server/statistics every 5 minutes."""

    async def _async_update_data(self) -> ImmichStats:
        stats = await self.client.get_statistics()
        return ImmichStats(
            photos=stats["photos"],
            videos=stats["videos"],
            usage_bytes=stats["usage"],
            usage_gb=round(stats["usage"] / (1024**3), 2),
        )
```

**Albums Coordinator:**
```python
class ImmichAlbumsCoordinator(DataUpdateCoordinator):
    """Polls /api/albums every 10 minutes."""

    async def _async_update_data(self) -> list[ImmichAlbum]:
        albums = await self.client.get_albums()
        return [
            ImmichAlbum(
                id=a["id"],
                name=a["albumName"],
                thumbnail_asset_id=a.get("albumThumbnailAssetId"),
                asset_count=a.get("assetCount", 0),
            )
            for a in albums
        ]
```

### 4. Sensors (`sensor.py`)

| Sensor | State | Unit | Attributes |
|--------|-------|------|------------|
| Photos | Integer (19925) | "photos" | — |
| Videos | Integer (234) | "videos" | — |
| Storage Used | Float (156.42) | "GB" | `usage_bytes` |
| Albums | Integer (15) | "albums" | `album_names[]` |

All extend `CoordinatorEntity[ImmichStatsCoordinator]` or `CoordinatorEntity[ImmichAlbumsCoordinator]`.

### 5. WebSocket Commands (`websocket.py`)

The card needs structured data that can't fit in sensor attributes. WebSocket commands bridge this.

**`immich_browser/albums`** — Get album list with metadata
```python
@websocket_api.websocket_command({
    vol.Required("type"): "immich_browser/albums",
})
@websocket_api.async_response
async def ws_get_albums(hass, connection, msg):
    entry = _get_entry(hass)
    albums = entry.runtime_data.albums_coordinator.data
    connection.send_result(msg["id"], {
        "albums": [asdict(a) for a in albums]
    })
```

**`immich_browser/album_assets`** — Get paginated assets for an album
```python
@websocket_api.websocket_command({
    vol.Required("type"): "immich_browser/album_assets",
    vol.Required("album_id"): str,
    vol.Optional("page", default=1): int,
    vol.Optional("size", default=50): int,
})
@websocket_api.async_response
async def ws_get_album_assets(hass, connection, msg):
    entry = _get_entry(hass)
    assets = await entry.runtime_data.client.get_album_assets(
        msg["album_id"], msg["page"], msg["size"]
    )
    connection.send_result(msg["id"], {"assets": assets})
```

**`immich_browser/recent_assets`** — Get recent photos
```python
@websocket_api.websocket_command({
    vol.Required("type"): "immich_browser/recent_assets",
    vol.Optional("page", default=1): int,
    vol.Optional("size", default=50): int,
})
@websocket_api.async_response
async def ws_get_recent_assets(hass, connection, msg):
    entry = _get_entry(hass)
    assets = await entry.runtime_data.client.get_recent_assets(
        msg["page"], msg["size"]
    )
    connection.send_result(msg["id"], {"assets": assets})
```

### 6. Lovelace Card (`immich-browser-card.js`)

**State machine for navigation:**
```
ALBUM_LIST → PHOTO_GRID → LIGHTBOX
     ↑            ↑           │
     └────────────┴───────────┘
                (back)
```

**Card state:**
```javascript
static get properties() {
    return {
        hass: { type: Object },
        config: { type: Object },
        _view: { type: String },          // "albums" | "recent" | "album_detail"
        _albums: { type: Array },
        _assets: { type: Array },
        _selectedAlbum: { type: Object },
        _lightboxAsset: { type: Object },  // null = no lightbox
        _page: { type: Number },
        _loading: { type: Boolean },
        _thumbnailCache: { type: Object },  // Map<assetId, blobUrl>
    };
}
```

**Thumbnail loading with blob URLs:**
```javascript
async _loadThumbnail(assetId) {
    if (this._thumbnailCache.has(assetId)) {
        return this._thumbnailCache.get(assetId);
    }
    const response = await fetch(
        `${this.config.immich_url}/api/assets/${assetId}/thumbnail`,
        { headers: { "x-api-key": this.config.api_key } }
    );
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    this._thumbnailCache.set(assetId, url);
    return url;
}
```

**Lazy loading with IntersectionObserver:**
```javascript
_setupLazyLoading() {
    this._observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const assetId = img.dataset.assetId;
                this._loadThumbnail(assetId).then(url => {
                    img.src = url;
                });
                this._observer.unobserve(img);
            }
        });
    }, { rootMargin: "200px" });
}
```

**Memory management:**
```javascript
_cleanupThumbnails() {
    // Revoke blob URLs not visible in current view
    const MAX_CACHED = 200;
    if (this._thumbnailCache.size > MAX_CACHED) {
        const entries = [...this._thumbnailCache.entries()];
        const toRemove = entries.slice(0, entries.length - MAX_CACHED);
        toRemove.forEach(([id, url]) => {
            URL.revokeObjectURL(url);
            this._thumbnailCache.delete(id);
        });
    }
}
```

### 7. Card Editor (same JS file)

**Editor config fields:**
- `immich_url` — Immich server URL
- `api_key` — Immich API key
- `title` — Card header (default: "Photos")
- `default_view` — "albums" | "recent" (default: "albums")
- `columns` — Grid columns 2-4 (default: 3)
- `photos_per_page` — Pagination size (default: 50)

## Data Flow

### Album Browsing
```
Card loads → callWS("immich_browser/albums")
    → WS handler reads albums_coordinator.data
    → returns album list [{id, name, thumbnail_asset_id, asset_count}]
    → card renders album grid
    → for each visible album: fetch thumbnail via blob URL pattern
    → user clicks album
    → callWS("immich_browser/album_assets", {album_id, page: 1, size: 50})
    → WS handler calls client.get_album_assets()
    → returns asset list [{id, type, createdAt}]
    → card renders photo grid
    → IntersectionObserver loads visible thumbnails via blob URLs
    → user scrolls → more thumbnails loaded
    → user clicks photo → lightbox overlay
```

### Recent Photos
```
Card loads with default_view="recent" (or user toggles)
    → callWS("immich_browser/recent_assets", {page: 1, size: 50})
    → WS handler calls client.get_recent_assets()
    → returns recent assets sorted by date desc
    → card renders photo grid (same component as album detail)
```

### Stats Refresh
```
Stats coordinator timer fires (every 5 min)
    → coordinator calls client.get_statistics()
    → sensors update
    → card stats bar updates (reads sensor state)
```

## File Structure

```
custom_components/immich_browser/
├── __init__.py              # async_setup (static path), async_setup_entry (coordinators + WS)
├── config_flow.py           # Single-step: URL + API key
├── coordinator.py           # Stats + Albums coordinators
├── sensor.py                # Photos, Videos, Storage, Albums sensors
├── websocket.py             # WS commands: albums, album_assets, recent_assets
├── api.py                   # ImmichClient wrapper
├── const.py                 # DOMAIN, DEFAULT_URL, etc.
├── manifest.json            # HACS metadata
├── strings.json             # UI strings for config flow
├── immich-browser-card.js   # LitElement card + editor (main JS file)
└── translations/
    └── en.json              # English translations
```

## Key Architectural Decisions

### Why Blob URLs Instead of HA Proxy

| Factor | Blob URLs (chosen) | HA Proxy |
|--------|-------------------|----------|
| Latency | Single hop: browser → Immich | Double hop: browser → HA → Immich |
| Complexity | JS fetch + createObjectURL | Python view/endpoint + routing |
| API key location | Card config (browser) | Server only |
| Throughput | Browser manages connections | HA event loop bottleneck |
| Offline/cache | Browser cache works | No caching benefit |

Blob URLs win on performance and simplicity. The API key trade-off is acceptable for local network.

### Why WebSocket Commands Instead of Sensor Attributes

| Factor | WebSocket Commands (chosen) | Sensor Attributes |
|--------|---------------------------|-------------------|
| Data size | Unlimited | 16KB attribute limit |
| Pagination | Native (pass page/size params) | Not possible |
| Real-time data | On-demand, always current | Stale until next poll |
| Complexity | More Python code | Simpler but limited |

WebSocket commands are necessary for album data with potentially hundreds of albums and thousands of assets.

### Why Two Coordinators Instead of One

Stats and albums have different characteristics:
- **Stats:** Small data, changes continuously, powers sensors
- **Albums:** Larger data, changes rarely, powers card UI
- Different polling intervals prevent unnecessary API calls
- Separation of concerns for maintainability

## Architectural Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Blob URL memory leaks | HIGH — browser OOM with large libraries | LRU cache with revokeObjectURL, max 200 cached |
| Immich API v2 breaking changes | MEDIUM — endpoints may change | Pin API paths, test against current Immich |
| Card JS file size | MEDIUM — may exceed 1000 lines | Careful code organization, no unnecessary features |
| WebSocket command latency | LOW — on-demand data fetch | Cache album list client-side, only fetch assets on drill-down |
| Concurrent thumbnail fetches overwhelming Immich | MEDIUM — 50+ parallel requests | Limit concurrent fetches to 6-8, queue the rest |
| Official HA Immich integration domain conflict | HIGH — can't use "immich" domain | Use "immich_browser" domain |
