# Stack Research

**Domain:** Home Assistant HACS custom integration with embedded Lovelace card for Immich photo browsing
**Researched:** 2026-02-19
**Confidence:** HIGH (Python/HA stack), MEDIUM (Immich API — verified against training data)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12+ (HA-bundled) | Integration backend | HA 2024.1+ ships Python 3.12 |
| `aiohttp` | HA-bundled (~3.9.x) | All HTTP calls to Immich API | Already in HA's virtualenv; no pip dep needed |
| `voluptuous` | HA-bundled | Config flow schema validation | Bundled |
| LitElement | HA-bundled (via shadow DOM) | Lovelace card UI | Single-file no-build approach |
| JavaScript (ES2020+) | No build step | Card logic | HA's built-in LitElement supports all modern JS |

### External APIs (No Python Libraries Needed)

| API | Endpoint | Auth | Notes |
|-----|----------|------|-------|
| Immich `/api/server/ping` | GET | `x-api-key` header | Returns `{"res": "pong"}` — health check |
| Immich `/api/server/statistics` | GET | `x-api-key` header | Returns `{photos, videos, usage}` — library stats |
| Immich `/api/albums` | GET | `x-api-key` header | Returns album list with `albumThumbnailAssetId` |
| Immich `/api/albums/{id}` | GET | `x-api-key` header | Returns album details with asset list |
| Immich `/api/assets/{id}/thumbnail` | GET | `x-api-key` header | Returns JPEG thumbnail binary (WEBP also supported) |
| Immich `/api/search/metadata` | POST | `x-api-key` header | Paginated search; `{order: "desc", page, size}` for recent photos |
| Immich `/api/assets/{id}/original` | GET | `x-api-key` header | Full-resolution image (for lightbox) |

### HA Integration Patterns

| Pattern | Import | Purpose | Why |
|---------|--------|---------|-----|
| `ConfigFlow` | `homeassistant.config_entries` | Setup UI with Immich URL + API key | Required for HACS |
| `DataUpdateCoordinator` | `homeassistant.helpers.update_coordinator` | Poll /server/statistics + /albums | Two coordinators: stats + albums |
| `CoordinatorEntity` | `homeassistant.helpers.update_coordinator` | Entity linked to coordinator | Auto state management |
| `SensorEntity` | `homeassistant.components.sensor` | Photo/video/storage/album count sensors | Standard sensor pattern |
| `async_register_static_paths` | `homeassistant.components.http` | Serve the .js card file | Replaces deprecated `register_static_path` |
| `StaticPathConfig` | `homeassistant.components.http` | Path config dataclass | Required for async static paths |
| `runtime_data` on `ConfigEntry` | `homeassistant.config_entries` | Store coordinators on entry | Modern 2025 pattern |

### Official HA Immich Integration

**Important finding:** Home Assistant added an official Immich integration in HA 2025.6. It provides:
- Upload photos from HA to Immich
- Sensor entities for server statistics
- Does NOT provide a browsing card or album UI

**Our integration coexists** — it focuses on the browsing/card experience that the official integration doesn't provide. We should:
- Use a different DOMAIN (e.g., `immich_browser` vs `immich`)
- Not duplicate sensor functionality unnecessarily (or offer them as optional)
- Focus entirely on the Lovelace card experience

**Confidence:** MEDIUM — the official integration's exact feature set may have expanded since training data cutoff.

## Critical Stack Decisions

### 1. Thumbnail Loading Strategy

**Problem:** Immich thumbnails require `x-api-key` header authentication. Standard `<img src="...">` can't send custom headers. This is the hardest technical challenge.

**Three approaches:**

| Approach | How | Pros | Cons |
|----------|-----|------|------|
| **A: Blob URLs** | Card fetches via JS `fetch()` with headers, creates `URL.createObjectURL(blob)` | Works perfectly, no proxy needed | Card needs API key, more JS code |
| **B: HA Proxy** | Integration provides `/api/immich_browser/thumbnail/{id}` endpoint | Card uses standard `<img src>`, no API key in card | Custom HA view, more Python code, double-hop latency |
| **C: HA Image Entity** | Create `camera` entities for each thumbnail | HA handles auth natively | Impractical — can't create entities for thousands of thumbnails |

**Recommendation: Approach A (Blob URLs)** — Card directly fetches thumbnails with API key. This is simpler, faster (no proxy hop), and the PROJECT.md already specifies this pattern. The API key is stored in card config.

**Confidence:** HIGH — this is a well-known pattern for authenticated image loading in web apps.

### 2. Card Config Stores API Key

**Trade-off:** The Immich API key must be in the card config (not just the integration config) because the browser needs it for direct thumbnail fetching.

**Security consideration:** The API key is stored in the Lovelace dashboard config, which is accessible to any HA admin. This is acceptable because:
- HA dashboard config is already a trusted context
- The alternative (proxy endpoint) adds complexity and latency
- Immich is on the local network anyway

**Confidence:** HIGH — this matches the project's stated constraint.

### 3. Two Coordinators

**Stats coordinator:** Polls `/api/server/statistics` every 5 minutes
- Used by sensors (photo count, video count, storage)

**Albums coordinator:** Polls `/api/albums` every 10 minutes
- Used by card (album list with thumbnails)
- Albums change less frequently than stats

**Why two?** Different polling intervals, different data shapes, different consumers.

**Confidence:** HIGH — standard HA pattern for multi-source polling.

### 4. Pagination for Large Libraries

**Problem:** 20k+ photos can't load at once. Must paginate.

**Immich API pagination:**
- `/api/search/metadata` supports `page` and `size` parameters
- `/api/albums/{id}` returns all assets — but can filter with search

**Card pagination strategy:**
- Load 50 assets per page
- Infinite scroll or "Load More" button
- Keep fetched assets in card state (don't re-fetch)

**Confidence:** MEDIUM — exact Immich pagination API may have changed. Verify endpoint params.

### 5. Static Path Registration (HA 2025.7+)

Same as argos-translate — use `async_register_static_paths` with `StaticPathConfig`.

### 6. WebSocket Commands for Album Data

**Problem:** The card needs album list and album detail data from the coordinator. Options:
1. Read from sensor attributes (limited by state character limits)
2. WebSocket command returning coordinator data

**Recommendation:** Use WebSocket commands for album data. Sensor attributes have a 255-character state limit and 16KB attribute limit. Album data with thumbnails can exceed this.

```python
# Register WS command
websocket_api.async_register_command(hass, ws_get_albums)

@websocket_api.websocket_command({
    vol.Required("type"): "immich_browser/albums",
})
@websocket_api.async_response
async def ws_get_albums(hass, connection, msg):
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    albums = entry.runtime_data.albums_coordinator.data
    connection.send_result(msg["id"], {"albums": albums})
```

Card calls:
```javascript
const result = await this.hass.callWS({type: "immich_browser/albums"});
```

**Confidence:** HIGH — WebSocket commands are the standard pattern for card-to-backend rich data transfer in HA.

## Dependency Graph

```
Immich Server (Docker, port 2283)
    ↑ HTTP (aiohttp)
    |
HA Integration (Python)
    ├── config_flow.py     → validates via GET /api/server/ping
    ├── coordinator.py     → stats coordinator (5min) + albums coordinator (10min)
    ├── sensor.py          → photos, videos, storage, album count
    ├── websocket.py       → WS commands for album/asset data
    ├── __init__.py        → registers WS commands + static path
    └── immich-browser-card.js → Lovelace card (LitElement)
         ├── fetch() with x-api-key → Immich /api/assets/{id}/thumbnail
         ├── callWS → HA backend for album list
         └── UI: album grid → photo grid → lightbox
```

## Version Compatibility

| Component | Min Version | Notes |
|-----------|-------------|-------|
| Home Assistant | 2025.7+ | For `async_register_static_paths` |
| Python | 3.12+ | HA 2024.1+ requirement |
| Immich | 1.90+ | Stable API; earlier versions may have different endpoints |
| HACS | 2.0+ | For custom integration distribution |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Immich API changes between versions | MEDIUM | Pin to known-working endpoints, test against current Immich |
| Thumbnail fetch performance with 20k+ photos | HIGH | Lazy loading, pagination, blob URL caching |
| API key exposure in card config | LOW | Acceptable for local network, documented |
| Official HA Immich integration conflicts | MEDIUM | Use different DOMAIN, don't duplicate functionality |
| Large album data exceeding WS message limits | LOW | Paginate album asset lists |
| Browser memory with many blob URLs | MEDIUM | Revoke blob URLs on scroll-out, limit cached blobs |
