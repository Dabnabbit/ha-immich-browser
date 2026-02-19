# Pitfalls Research

**Domain:** Home Assistant HACS integration pitfalls for Immich photo browsing
**Researched:** 2026-02-19
**Confidence:** HIGH (HA integration patterns), MEDIUM (Immich API edge cases)

## Pitfall Catalog

### PITFALL-01: `register_static_path` Removed in HA 2025.7

**Severity:** CRITICAL — Integration fails to load on modern HA
**Phase Impact:** Phase 1 (integration setup)

**Problem:**
The old `hass.http.register_static_path()` is synchronous and was removed in HA 2025.7. The scaffold template may still use it.

**Fix:**
```python
from homeassistant.components.http import StaticPathConfig

await hass.http.async_register_static_paths([
    StaticPathConfig(
        url_path=f"/{DOMAIN}/immich-browser-card.js",
        path=str(Path(__file__).parent / "immich-browser-card.js"),
        cache_headers=True,
    )
])
```

**Detection:** hassfest and hacs/action will flag this.

### PITFALL-02: aiohttp Session Leak

**Severity:** HIGH — Connection pool exhaustion over time
**Phase Impact:** Phase 1 (API client)

**Problem:**
Creating `aiohttp.ClientSession()` manually instead of using HA's shared session.

**Fix:**
```python
from homeassistant.helpers.aiohttp_client import async_get_clientsession
session = async_get_clientsession(hass)
```

Never call `session.close()` — HA manages lifecycle.

### PITFALL-03: Thumbnail Auth Requires Custom Headers

**Severity:** HIGH — Thumbnails won't load without proper auth
**Phase Impact:** Phase 3 (card development)

**Problem:**
Immich requires `x-api-key` header for thumbnail endpoints. Standard `<img src="url">` can't send custom headers. Without blob URLs, all thumbnails return 401.

**Fix:**
Use fetch + createObjectURL pattern:
```javascript
const response = await fetch(url, {
    headers: { "x-api-key": this.config.api_key }
});
const blob = await response.blob();
return URL.createObjectURL(blob);
```

**Warning:** This means the API key MUST be in the card config, not just the integration config.

### PITFALL-04: Blob URL Memory Leak

**Severity:** HIGH — Browser OOM on large libraries
**Phase Impact:** Phase 3 (card development)

**Problem:**
Each `URL.createObjectURL(blob)` creates a reference that persists until `URL.revokeObjectURL()` is called or the page is unloaded. With 20k+ photos, scrolling through the library without revoking creates thousands of blob references consuming gigabytes of memory.

**Fix:**
- Implement LRU cache with maximum size (200 entries)
- Revoke blob URLs when evicting from cache
- Call `revokeObjectURL` on all cached URLs in `disconnectedCallback()`
```javascript
disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up all blob URLs
    this._thumbnailCache.forEach(url => URL.revokeObjectURL(url));
    this._thumbnailCache.clear();
}
```

### PITFALL-05: Missing `unique_id` on Config Entry

**Severity:** MEDIUM — Allows duplicate config entries
**Phase Impact:** Phase 1 (config flow)

**Problem:**
If `ConfigFlow` doesn't set a `unique_id`, users can add the same Immich server multiple times.

**Fix:**
```python
async def async_step_user(self, user_input=None):
    if user_input:
        unique_id = user_input["url"]  # URL is unique per server
        await self.async_set_unique_id(unique_id)
        self._abort_if_unique_id_configured()
```

### PITFALL-06: `iot_class` Mismatch in `manifest.json`

**Severity:** LOW — Fails hassfest validation
**Phase Impact:** Phase 1 (manifest)

**Problem:**
Must be `local_polling` since Immich is on the local network and we poll for data.

**Fix:**
```json
{
    "iot_class": "local_polling"
}
```

### PITFALL-07: Immich API URL Normalization

**Severity:** MEDIUM — API calls fail with double slashes or missing paths
**Phase Impact:** Phase 1 (API client)

**Problem:**
Users may enter the URL as:
- `http://192.168.50.250:2283` (no trailing slash)
- `http://192.168.50.250:2283/` (with trailing slash)
- `http://192.168.50.250:2283/api` (with /api prefix)

If not normalized, API calls become `http://host:2283//api/server/ping` or similar.

**Fix:**
```python
def __init__(self, session, url, api_key):
    self._url = url.rstrip("/")
    # Always construct paths as: self._url + "/api/..."
```

### PITFALL-08: Official HA Immich Integration Domain Conflict

**Severity:** HIGH — Integration won't load if domain conflicts
**Phase Impact:** Phase 1 (manifest)

**Problem:**
HA 2025.6 added an official `immich` integration. If our custom integration also uses `immich` as the domain, it will conflict with the official one.

**Fix:**
Use `immich_browser` as the domain:
```json
{
    "domain": "immich_browser",
    "name": "Immich Browser"
}
```

This allows both integrations to coexist — official for upload/sensors, ours for browsing card.

### PITFALL-09: Concurrent Thumbnail Fetches Overwhelming Server

**Severity:** MEDIUM — Immich server becomes unresponsive
**Phase Impact:** Phase 3 (card development)

**Problem:**
When loading a photo grid with 50 thumbnails, the card fires 50+ concurrent fetch requests. This can overwhelm the Immich server, especially on QNAP with limited CPU/RAM.

**Fix:**
Implement a fetch queue with concurrency limit:
```javascript
class FetchQueue {
    constructor(maxConcurrent = 6) {
        this._max = maxConcurrent;
        this._active = 0;
        this._queue = [];
    }

    async add(fetchFn) {
        if (this._active >= this._max) {
            await new Promise(resolve => this._queue.push(resolve));
        }
        this._active++;
        try {
            return await fetchFn();
        } finally {
            this._active--;
            if (this._queue.length > 0) {
                this._queue.shift()();
            }
        }
    }
}
```

### PITFALL-10: WebSocket Commands Not Registered Before Card Loads

**Severity:** MEDIUM — Card errors on first load after HA restart
**Phase Impact:** Phase 2 (WebSocket commands)

**Problem:**
If WebSocket commands are registered in `async_setup_entry` and the card loads before the entry is set up (e.g., during HA startup), the card's `callWS` call will fail with "Unknown command".

**Fix:**
Register WebSocket commands in `async_setup` (not `async_setup_entry`). The WS handler dynamically looks up the active entry:
```python
async def async_setup(hass, config):
    websocket_api.async_register_command(hass, ws_get_albums)
    # ...
```

### PITFALL-11: Immich `/api/search/metadata` Requires POST

**Severity:** LOW — Easy to mistake as GET
**Phase Impact:** Phase 2 (API client)

**Problem:**
The "recent photos" endpoint uses POST /api/search/metadata, not GET. The search body includes sort order and pagination.

**Fix:**
```python
async def get_recent_assets(self, page=1, size=50):
    payload = {
        "order": "desc",
        "page": page,
        "size": size,
    }
    async with self._session.post(
        f"{self._url}/api/search/metadata",
        json=payload,
        headers=self._headers,
    ) as resp:
        data = await resp.json()
        return data.get("assets", {}).get("items", [])
```

**Note:** The response structure may vary by Immich version. The `assets.items` path is based on Immich v1.90+.

### PITFALL-12: Card Size and Complexity

**Severity:** MEDIUM — Maintainability concern
**Phase Impact:** Phase 3 (card development)

**Problem:**
The card needs: album grid, photo grid, lightbox, lazy loading, blob URL management, pagination, navigation, editor. In a single JS file without build tools, this can easily exceed 1000 lines and become hard to maintain.

**Fix:**
- Organize code with clear section comments
- Use class methods for each view (renderAlbums, renderGrid, renderLightbox)
- Keep CSS minimal (use HA's built-in CSS variables)
- Consider splitting editor into separate section at bottom of file
- Don't over-engineer — simple CSS grid, basic lightbox

### PITFALL-13: Video Asset Handling in Grid

**Severity:** LOW — UX issue, not a blocker
**Phase Impact:** Phase 3 (card development)

**Problem:**
Video assets have thumbnails just like photos, but should be visually distinguished. Without a badge, users click expecting a photo and get nothing (since video playback is out of scope).

**Fix:**
- Check asset `type` field ("IMAGE" vs "VIDEO")
- Overlay small video icon badge on video thumbnails
- In lightbox, show "Open in Immich" link instead of trying to play
```javascript
${asset.type === 'VIDEO' ? html`<div class="video-badge">▶</div>` : ''}
```

### PITFALL-14: Immich Server Version Differences

**Severity:** MEDIUM — API response format may differ
**Phase Impact:** Phase 1-3

**Problem:**
Immich has frequent releases and the API evolves. Field names, response structures, and available endpoints may differ between versions (e.g., v1.80 vs v1.106).

**Fix:**
- Target Immich v1.90+ as minimum (stable API era)
- Use defensive coding: `data.get("field", default)` instead of `data["field"]`
- Log unexpected API responses for debugging
- Document supported Immich version range

### PITFALL-15: CORS Issues with Direct Thumbnail Fetch

**Severity:** MEDIUM-HIGH — Thumbnails may not load in some setups
**Phase Impact:** Phase 3 (card development)

**Problem:**
When the card fetches thumbnails directly from the Immich server, CORS (Cross-Origin Resource Sharing) may block the request if the HA dashboard and Immich server are on different origins (different ports count as different origins).

Immich's default Docker configuration may not include CORS headers for cross-origin requests from HA.

**Fix:**
Several options:
1. **Immich usually sets CORS headers** — verify default Docker config
2. **HA proxy approach** — if CORS is an issue, fall back to proxying through HA (adds complexity)
3. **Configure reverse proxy** — if using nginx/traefik, add CORS headers
4. **Immich environment variable** — `IMMICH_CORS_ALLOWED_ORIGINS` if available

**Recommended:** Test with default Immich Docker setup first. If CORS is an issue, implement an HA proxy endpoint as fallback.

**Confidence:** MEDIUM — CORS behavior depends on Immich version and deployment. Must test.

### PITFALL-16: IntersectionObserver Not Available in Shadow DOM

**Severity:** LOW — Edge case in some environments
**Phase Impact:** Phase 3 (card development)

**Problem:**
LitElement cards render in Shadow DOM. IntersectionObserver typically works with Shadow DOM but the `root` option may need to be set correctly.

**Fix:**
```javascript
this._observer = new IntersectionObserver(callback, {
    root: this.shadowRoot.querySelector('.grid-container'),
    rootMargin: '200px',
});
```

Or use `root: null` (viewport) which works regardless of Shadow DOM.

## Phase-to-Pitfall Mapping

| Phase | Relevant Pitfalls |
|-------|-------------------|
| Phase 1: Integration Core | PITFALL-01, 02, 05, 06, 07, 08, 14 |
| Phase 2: Data Layer + WS | PITFALL-10, 11, 14 |
| Phase 3: Lovelace Card | PITFALL-03, 04, 09, 12, 13, 15, 16 |
| Phase 4: HACS Distribution | PITFALL-01, 06, 08 |

## "Looks Done But Isn't" Checklist

- [ ] `register_static_path` replaced with `async_register_static_paths`
- [ ] `async_get_clientsession(hass)` used (not manual session)
- [ ] Domain is `immich_browser` (not `immich`)
- [ ] `unique_id` set in config flow
- [ ] `iot_class: local_polling` in manifest
- [ ] URL normalized (strip trailing slash)
- [ ] Thumbnail loading uses blob URL pattern with x-api-key header
- [ ] Blob URL cache with LRU eviction and revokeObjectURL
- [ ] `disconnectedCallback` cleans up blob URLs
- [ ] Concurrent thumbnail fetch limit (6-8 max)
- [ ] WebSocket commands registered in `async_setup` (not `async_setup_entry`)
- [ ] `/api/search/metadata` is POST (not GET)
- [ ] Video badge on video assets in grid
- [ ] CORS tested with default Immich Docker setup
- [ ] IntersectionObserver root set correctly for Shadow DOM
- [ ] API key in card config (not just integration config)
- [ ] Defensive API parsing with `.get()` defaults

## Recovery Strategies

| Pitfall | If Hit During Development | If Hit In Production |
|---------|--------------------------|---------------------|
| PITFALL-01 | Replace in code, test with hassfest | Urgent patch release |
| PITFALL-02 | Refactor to shared session | HA restart clears leaked connections |
| PITFALL-03 | Implement blob URL pattern | Thumbnails blank until fixed |
| PITFALL-04 | Add LRU cache + revoke logic | Users report slow browser, need update |
| PITFALL-08 | Rename domain to immich_browser | Breaking change, requires reinstall |
| PITFALL-09 | Add fetch queue | Immich server sluggish until fixed |
| PITFALL-15 | Test CORS, add proxy fallback | Need proxy endpoint patch |
