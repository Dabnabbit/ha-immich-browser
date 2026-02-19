# Features Research

**Domain:** Immich photo browsing integration for Home Assistant
**Researched:** 2026-02-19
**Confidence:** HIGH (feature scoping), MEDIUM (competitive landscape — based on training data)

## Competitive Landscape

### Existing HA Photo/Gallery Solutions

| Solution | Type | Immich-specific? | Browsing? | Notes |
|----------|------|------------------|-----------|-------|
| Official HA Immich | HA Integration | YES | NO | Upload + stats sensors only (HA 2025.6+) |
| Gallery Card | Lovelace card | NO | YES | Local media only, no Immich API integration |
| Media Browser | HA built-in | NO | Partial | Designed for media players, not photo galleries |
| Immich Web UI | Standalone | YES | YES | Full-featured but separate app/tab |
| Immich Mobile | Mobile app | YES | YES | Best experience but separate from HA |
| Photoprism integration | Community | NO | Partial | Different photo server |

**Key finding:** There is NO existing Lovelace card for browsing Immich photos within HA. The official integration handles upload/sensors. Users wanting to browse photos from HA must open Immich separately.

**This is a genuine gap** — the card brings photo browsing into the HA dashboard context where household members already are (tablets, wall panels, phones).

### Immich Photo Server Ecosystem

Immich is the dominant self-hosted photo solution:
- Docker-based deployment (server + ML + database + Redis)
- Well-documented REST API with OpenAPI spec
- Active development with frequent releases
- Growing user base (alternative to Google Photos)
- Machine learning: face detection, CLIP search, object recognition

## Feature Analysis

### Must-Have (v1) Features

#### 1. Config Flow with Connection Validation
**Priority:** P0
**Complexity:** Low
**Details:**
- Fields: Immich URL (full URL with port, e.g., `http://192.168.50.250:2283`), API Key
- Validation: GET /api/server/ping with x-api-key header → expect `{"res": "pong"}`
- Store as config entry with `runtime_data` pattern
- Unique ID: derive from server URL to prevent duplicates

#### 2. Statistics Sensors
**Priority:** P1
**Complexity:** Low
**Details:**
- **Photos sensor:** Total photo count from `/api/server/statistics` → `photos`
- **Videos sensor:** Total video count → `videos`
- **Storage Used sensor:** Total usage in GB → `usage` (bytes → GB conversion)
- **Albums sensor:** Count from `/api/albums` array length
- All extend `CoordinatorEntity` for auto-updates

#### 3. Album Grid View (Card Home)
**Priority:** P0 — Primary card view
**Complexity:** Medium
**Details:**
- Grid of album thumbnails with names and photo counts
- Thumbnail loaded via blob URL (fetch with x-api-key → createObjectURL)
- Album thumbnail from `albumThumbnailAssetId`
- Click album → drill into photo grid
- Responsive grid (configurable columns: 2-4)

#### 4. Photo Grid (Album Detail)
**Priority:** P0 — Core browsing experience
**Complexity:** Medium-High
**Details:**
- Grid of photo thumbnails from album assets
- Paginated: load 50 at a time, infinite scroll or "Load More"
- Lazy loading: only fetch thumbnails visible in viewport (IntersectionObserver)
- Video badge overlay on video assets (small icon on thumbnail)
- Click photo → lightbox preview

#### 5. Recent Photos View
**Priority:** P1
**Complexity:** Medium
**Details:**
- Most recent N assets (configurable, default 50)
- Uses `/api/search/metadata` with `order: desc` sort
- Displayed as photo grid (same component as album detail)
- Toggle between "Albums" and "Recent" views

#### 6. Lightbox Preview
**Priority:** P1
**Complexity:** Medium
**Details:**
- Full-screen overlay on photo click
- Loads larger image (original or larger thumbnail)
- Swipe/arrow navigation between photos
- Close button / click outside to dismiss
- Shows photo date/filename in overlay

#### 7. Navigation
**Priority:** P0
**Complexity:** Low
**Details:**
- Album list → Album detail → Lightbox
- Back button in header
- Stats bar at top/bottom: "X photos · Y videos · Z GB"
- Card header with configurable title

#### 8. Visual Card Editor
**Priority:** P1
**Complexity:** Medium
**Details:**
- Immich URL input
- API Key input
- Card title
- Default view (Albums / Recent)
- Columns (2-4)
- Photos per page

### Nice-to-Have (v1.x) Features

#### 9. Thumbnail Caching
**Priority:** P2
**Details:**
- Cache blob URLs to avoid re-fetching same thumbnails
- LRU cache with max size (e.g., 200 thumbnails)
- Revoke old blob URLs to prevent memory leaks

#### 10. Pull-to-Refresh
**Priority:** P2
**Details:**
- Refresh album list or photo grid on pull-down gesture
- Useful on mobile/tablet

#### 11. Stats Bar
**Priority:** P2
**Details:**
- Shows "19,925 photos · 234 videos · 156 GB" at top of card
- Reads from stats coordinator data (via WebSocket or sensor attributes)

### Deferred (v2+) Features

| Feature | Why Deferred |
|---------|-------------|
| Search within card | Complex UI, Immich's search API is powerful but complex to expose |
| Favorites/ratings | Requires Immich API write operations, different use case |
| Timeline view | Complex chronological layout, Immich web UI handles this well |
| Map view | Requires map integration, too complex for v1 card |
| Video playback | Complex (HLS/native video), open in Immich instead |
| Face recognition browsing | Complex ML feature, Immich handles natively |
| Photo upload | Official HA Immich integration handles this |
| Sharing/external links | Use Immich web UI |

## Differentiators

### What Makes This Unique

1. **Only Immich browsing card for HA** — Fills the gap between official Immich integration (upload/sensors) and full Immich web UI. At-a-glance family photo browsing from HA dashboard.

2. **Wall panel / tablet optimized** — Designed for the HA dashboard context where families interact with their home. Photo browsing on the kitchen tablet while cooking.

3. **Album-first navigation** — Matches how families organize photos (by event, trip, person) rather than timeline view.

4. **Lightweight** — Single JS file, no build tooling, loads fast on low-power devices (tablets, fire sticks).

5. **Performance with large libraries** — Pagination, lazy loading, and blob URL management designed for 20k+ photo libraries.

### Target Use Cases

- Family browsing photos on HA dashboard (tablet, wall panel)
- Quick album preview during family gatherings
- Recent photos widget on home screen
- Library stats at a glance

## Scope Assessment

**Current scope is ambitious but achievable for v1.** The core loop (album grid → photo grid → lightbox) is well-defined. The main technical challenge is thumbnail loading performance with auth.

**Key complexity areas:**
1. **Thumbnail blob URL management** — Fetching, caching, and revoking blob URLs is the most complex card logic
2. **Pagination** — Infinite scroll with lazy loading across 20k+ photos
3. **Card size** — Album grid + photo grid + lightbox + editor in a single JS file = 800-1200 lines

**Recommendation:** Phase the card carefully — album grid first, then photo grid, then lightbox. Each builds on the previous.

## Recommendations

1. **Start with sensors + basic card structure** — Proves the integration works before complex card logic
2. **Album grid before photo grid** — Natural navigation order, simpler than full photo grid
3. **Blob URL approach for thumbnails** — Direct fetch with API key, no proxy needed
4. **WebSocket commands for album data** — Sensor attributes can't hold album lists with thumbnails
5. **IntersectionObserver for lazy loading** — Only fetch thumbnails visible in viewport
6. **Memory management is critical** — Revoke blob URLs on scroll-out, limit cache size
7. **Test with actual 20k+ library** — Performance testing must happen against real data, not mocks
