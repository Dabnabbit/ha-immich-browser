# Research Summary — Immich Browser for Home Assistant

**Project:** ha-immich-browser — HA HACS integration for browsing an Immich photo library from Lovelace dashboards
**Synthesized:** 2026-02-19
**Synthesized from:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

This project fills a genuine gap in the Home Assistant ecosystem: there is no Lovelace card for browsing an Immich photo library from within a HA dashboard. The official HA Immich integration (added in HA 2025.6) handles upload and statistics sensors but provides no browsing UI. Families using Immich as their self-hosted Google Photos replacement must open a separate browser tab or app to look at photos. This integration brings photo browsing — album grid, photo grid, and lightbox — directly into the HA dashboard context where household members already interact with their home on tablets and wall panels.

The recommended approach is a standard two-component HACS integration: a Python backend (config flow, two DataUpdateCoordinators, WebSocket commands, and sensor entities) plus a single-file LitElement Lovelace card. The most critical technical challenge is thumbnail authentication — Immich requires an `x-api-key` header that standard `<img>` tags cannot send. The solution is a browser-side blob URL pattern where the card fetches thumbnails via `fetch()` with the auth header and creates object URLs. This means the API key must live in both the integration config (for the Python coordinator) and the card config (for the browser). This trade-off is acceptable because HA dashboard config is already a trusted admin context and the alternative (proxying through HA) adds latency and complexity with no meaningful security benefit on a local network.

The primary risks center on browser memory management (blob URL leaks with 20k+ photo libraries), domain conflict with the official `immich` integration (must use domain `immich_browser`), CORS behavior when fetching thumbnails cross-origin, and the evolving Immich API. All risks are mitigatable through well-established patterns: LRU blob URL cache with revocation, HA 2025.7+ static path API, a fetch concurrency queue, and defensive API parsing. The implementation is achievable in 3-4 phases, with the card being the most complex deliverable (~800-1200 lines of JS in a single no-build file).

---

## Key Findings

### From STACK.md

| Technology | Rationale |
|------------|-----------|
| Python 3.12 (HA-bundled) | No external dependencies; everything needed is already in HA's virtualenv |
| `aiohttp` (HA-bundled) | All HTTP to Immich; use `async_get_clientsession(hass)` — never create a manual session |
| `voluptuous` (HA-bundled) | Config flow schema validation; bundled with HA |
| LitElement (HA-bundled) | Single-file, no-build Lovelace card; HA ships LitElement in its bundle |
| `DataUpdateCoordinator` | Two coordinators: stats (5 min) and albums (10 min), different consumers and polling intervals |
| WebSocket commands | Only viable path for card-to-backend rich data; sensor attributes hit 16KB limit |
| `async_register_static_paths` | Required for HA 2025.7+; old `register_static_path` was removed |

**Critical version requirements:**
- Home Assistant 2025.7+ (for `async_register_static_paths` / `StaticPathConfig`)
- Immich 1.90+ (stable API era)
- HACS 2.0+

**Official integration coexistence:** HA 2025.6 added an official `immich` integration (upload + sensors). This project MUST use domain `immich_browser` and SHOULD avoid duplicating sensor functionality (sensors are optional/additive, not the primary value).

### From FEATURES.md

**Table stakes (must-have for v1):**

| Feature | Priority | Complexity |
|---------|----------|------------|
| Config flow with connection validation | P0 | Low |
| Album grid (card home view) | P0 | Medium |
| Photo grid (album detail) with lazy loading | P0 | Medium-High |
| Navigation (album → grid → lightbox, back button) | P0 | Low |
| Lightbox preview with arrow navigation | P1 | Medium |
| Recent photos view | P1 | Medium |
| Statistics sensors (photos, videos, storage, albums) | P1 | Low |
| Visual card editor | P1 | Medium |

**Differentiators (nice-to-have for v1.x):**
- LRU thumbnail cache (200 entries with blob URL revocation)
- Stats bar (library totals displayed in card header)
- Pull-to-refresh gesture on mobile/tablet

**Deferred to v2+:** Search within card, video playback, favorites, timeline view, map view, face recognition browsing, photo upload (covered by official integration), sharing.

**Key insight:** The feature scope is ambitious but achievable. The recommendation from FEATURES.md is to phase the card carefully: album grid → photo grid → lightbox, each building on the previous.

### From ARCHITECTURE.md

**Component decomposition (Python backend):**

| File | Responsibility |
|------|---------------|
| `__init__.py` | Static path registration; WebSocket command registration; `async_setup_entry` orchestration |
| `config_flow.py` | Single-step: URL + API key input, validate via `/api/server/ping` |
| `api.py` | `ImmichClient`: all Immich REST calls; URL normalization; timeout handling |
| `coordinator.py` | `ImmichStatsCoordinator` (5min) and `ImmichAlbumsCoordinator` (10min) |
| `sensor.py` | 4 sensors: photos, videos, storage (GB), album count — all extend `CoordinatorEntity` |
| `websocket.py` | 3 WS commands: `immich_browser/albums`, `immich_browser/album_assets`, `immich_browser/recent_assets` |
| `immich-browser-card.js` | LitElement card + editor; all browsing UI; blob URL management |

**Card state machine:**
```
ALBUM_LIST → PHOTO_GRID → LIGHTBOX
     ↑            ↑           │
     └────────────┴───────────┘ (back)
```

**Data flow:** Card uses `callWS` for album/asset metadata (from coordinator/Immich), then fetches thumbnails directly from Immich via `fetch()` + `createObjectURL()`. Stats coordinator drives sensor state updates on 5-minute interval; card reads stats from sensor state.

**Key architectural decisions:**
- Blob URLs over HA proxy: single hop, no event loop bottleneck, simpler code
- WebSocket commands over sensor attributes: no 16KB limit, supports pagination, on-demand freshness
- Two coordinators over one: different polling intervals, different data shapes, separation of concerns
- `runtime_data` on `ConfigEntry` to store coordinators and client (modern 2025 HA pattern)

### From PITFALLS.md

**Critical pitfalls (must not miss):**

| Pitfall | Severity | Phase | Prevention |
|---------|----------|-------|------------|
| `register_static_path` removed in HA 2025.7 | CRITICAL | Phase 1 | Use `async_register_static_paths` + `StaticPathConfig` from day one |
| Domain conflict with official `immich` integration | HIGH | Phase 1 | Use `immich_browser` as domain in manifest |
| aiohttp session leak (manual session creation) | HIGH | Phase 1 | Always use `async_get_clientsession(hass)` |
| Thumbnail auth requires blob URL pattern | HIGH | Phase 3 | `fetch()` + `createObjectURL()`; API key in card config |
| Blob URL memory leak (no LRU eviction) | HIGH | Phase 3 | LRU cache (200 max), `revokeObjectURL` on eviction, cleanup in `disconnectedCallback` |
| CORS blocking direct thumbnail fetch | MEDIUM-HIGH | Phase 3 | Test with default Immich Docker; have HA proxy as fallback |
| Concurrent fetch overwhelming Immich server | MEDIUM | Phase 3 | `FetchQueue` with max 6-8 concurrent requests |
| WS commands registered in `async_setup_entry` (race on startup) | MEDIUM | Phase 2 | Register in `async_setup` instead; handler dynamically looks up active entry |
| `/api/search/metadata` is POST not GET | LOW | Phase 2 | Explicit `session.post()` with JSON body |
| Missing `unique_id` on config entry | MEDIUM | Phase 1 | `async_set_unique_id(url)` + `_abort_if_unique_id_configured()` |

**"Looks done but isn't" checklist (from PITFALLS.md) is the single most important quality gate.** It must be applied as a pre-commit review at the end of each phase.

---

## Implications for Roadmap

Research strongly suggests a 4-phase structure. Each phase is independently deliverable and testable.

### Suggested Phase Structure

**Phase 1 — Integration Foundation**
*Rationale:* Before any card logic, the Python backend must be solid. Config flow, API client, static path registration, and manifest setup are the foundation everything else rests on. Get hassfest and HACS validation green here.

What it delivers:
- Working config flow (URL + API key → ping validation → entry created)
- `ImmichClient` with all API methods
- `manifest.json` with correct domain (`immich_browser`), `iot_class: local_polling`, and HACS metadata
- Static path serving the (initially stub) JS file
- Both coordinators wired up (data flows, no consumers yet)

Features from FEATURES.md: Config Flow with Connection Validation (P0)
Pitfalls to avoid: PITFALL-01, 02, 05, 06, 07, 08, 14

**Research flag:** Standard HA patterns — no phase-level research needed. hassfest CI catches most issues.

---

**Phase 2 — Sensors and WebSocket Data Layer**
*Rationale:* Sensors validate coordinator data is correct and give a UI-verifiable artifact. WebSocket commands must be proven working before the card depends on them. This phase also forces correct `async_setup` vs `async_setup_entry` WS registration.

What it delivers:
- 4 sensor entities (photos, videos, storage GB, album count) visible in HA states
- 3 WebSocket commands functional and testable via HA developer tools
- Albums coordinator data verified against real Immich library

Features from FEATURES.md: Statistics Sensors (P1)
Pitfalls to avoid: PITFALL-10, 11, 14

**Research flag:** No research needed. Standard `CoordinatorEntity` + `SensorEntity` patterns.

---

**Phase 3 — Lovelace Card (Core Browsing)**
*Rationale:* The card is the primary value proposition and the most complex deliverable. Build it incrementally: album grid first (simplest view, relies on WS + blob URLs), then photo grid with lazy loading and pagination, then lightbox. The card editor comes last since it's cosmetic.

What it delivers:
- Album grid view with blob URL thumbnails
- Photo grid with IntersectionObserver lazy loading and pagination (50/page)
- Lightbox with arrow navigation and photo metadata
- Recent photos view (same grid component, different data source)
- Navigation state machine (album → grid → lightbox → back)
- Card editor with all config fields
- LRU blob URL cache (200 entries) with `revokeObjectURL` eviction
- FetchQueue with max 6 concurrent thumbnail requests
- Video badge on video assets

Features from FEATURES.md: Album Grid (P0), Photo Grid (P0), Navigation (P0), Lightbox (P1), Recent Photos (P1), Card Editor (P1)
Pitfalls to avoid: PITFALL-03, 04, 09, 12, 13, 15, 16

**Research flag: NEEDS PHASE RESEARCH.** CORS behavior with default Immich Docker is unverified. The proxy fallback path needs a concrete decision before this phase begins. Also: confirm current Immich thumbnail endpoint path and response format against a live instance.

---

**Phase 4 — Polish, Hardening, and HACS Distribution**
*Rationale:* Before HACS submission, address performance with large real-world libraries (20k+ photos), add the stats bar, write README and HACS metadata, and run the full "looks done but isn't" checklist.

What it delivers:
- Stats bar in card header ("19,925 photos · 234 videos · 156 GB")
- Performance validation against 20k+ photo library (pagination confirmed working)
- HACS `hacs.json` metadata file
- README with configuration examples and screenshots
- Full checklist review from PITFALLS.md
- hassfest and hacs/action CI passing

Features from FEATURES.md: Stats Bar (P2), Thumbnail Caching hardening (P2)
Pitfalls to avoid: PITFALL-01, 06, 08 (re-verify at distribution time)

**Research flag:** No research needed. Standard HACS distribution patterns.

---

### Phase Summary Table

| Phase | Name | Key Deliverable | Pitfalls | Research Needed |
|-------|------|-----------------|----------|-----------------|
| 1 | Integration Foundation | Config flow, API client, coordinators, manifest | 01, 02, 05, 06, 07, 08, 14 | No |
| 2 | Sensors + WebSocket Layer | 4 sensors, 3 WS commands working | 10, 11, 14 | No |
| 3 | Lovelace Card | Full browsing UI: album grid, photo grid, lightbox | 03, 04, 09, 12, 13, 15, 16 | YES — CORS + Immich API |
| 4 | Polish + HACS | Stats bar, perf testing, distribution | 01, 06, 08 | No |

---

## Research Flags

**Phase 3 requires pre-phase research before planning begins.**

Questions to resolve:
1. **CORS:** Does Immich's default Docker setup (`immich-server` container) send `Access-Control-Allow-Origin` headers that allow cross-origin `fetch()` from a HA dashboard on a different port? If not, is the `IMMICH_CORS_ALLOWED_ORIGINS` environment variable the fix, or does an HA proxy endpoint need to be designed in Phase 3?
2. **Thumbnail endpoint:** Confirm `/api/assets/{id}/thumbnail` still exists in the latest Immich release, and verify whether `?size=thumbnail` or `?size=preview` query param is needed for appropriately sized thumbnails.
3. **Album assets pagination:** Verify whether `/api/albums/{id}` returns all assets in one response or whether separate search API calls are needed for large albums (100+ assets).
4. **Search metadata response shape:** Confirm `data.assets.items[]` is the correct path in the current `/api/search/metadata` POST response.

**Phases 1, 2, and 4 follow well-documented HA patterns — no pre-phase research needed.**

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| HA integration patterns (config flow, coordinators, sensors, static paths, WS commands) | HIGH | Established HA patterns with strong documentation; training data comprehensive |
| Stack technology choices (Python, LitElement, aiohttp, voluptuous) | HIGH | All HA-bundled; no external dependencies; minimal version risk |
| Feature scoping and prioritization | HIGH | Clear gap analysis; v1 scope well-bounded; deferral decisions logical |
| Architecture and component decomposition | HIGH | Standard HA two-layer pattern; blob URL approach is well-established |
| Pitfall identification and mitigations | HIGH (HA pitfalls) / MEDIUM (Immich-specific) | HA pitfalls are known and well-documented; Immich CORS and API shape need live verification |
| Immich API endpoint stability | MEDIUM | Immich 1.90+ is the stable API era but frequent releases mean edge cases possible; must test against live instance |
| CORS behavior with default Immich Docker | MEDIUM-LOW | Conflicting information; must empirically test before Phase 3 design is finalized |
| Official HA Immich integration feature set | MEDIUM | Integration added HA 2025.6; exact current feature set may have expanded; needs live verification to confirm we don't duplicate |

**Overall confidence: MEDIUM-HIGH.** The HA integration layer is well-understood. The primary uncertainty is the Immich API layer (CORS, endpoint shapes, response structures) which can only be fully resolved against a live Immich instance.

---

## Gaps to Address During Planning

1. **CORS behavior is unresolved.** The PITFALLS.md rates this MEDIUM-HIGH and the fix depends on the answer. Planning for Phase 3 must make a definitive choice: blob URL with CORS configured, or HA proxy endpoint, or both with a runtime fallback. This needs a real Immich Docker instance to test.

2. **Immich API response shapes need live verification.** Specifically: thumbnail endpoint path and query params, album asset response structure, and `/api/search/metadata` response shape. These should be verified against the current Immich version running in the dev environment before Phase 2 or 3 implementation.

3. **Official HA Immich integration feature parity.** The integration was added in HA 2025.6 and may have expanded since the research training cutoff. Before finalizing sensor design in Phase 2, verify what the official integration currently exposes — sensors we duplicate create user confusion and HACS friction.

4. **Card size management strategy.** At 800-1200+ lines in a single JS file with no build tooling, code organization discipline is critical. A section-comment convention should be established before Phase 3 begins to keep the file maintainable.

5. **Minimum supported HA version decision.** Requiring HA 2025.7+ is technically correct for `async_register_static_paths` but limits the user base. This should be explicitly confirmed as an acceptable constraint before Phase 1 begins.

6. **Immich version compatibility range.** The research recommends 1.90+ but Immich's latest stable is significantly higher. Decide whether to target "1.90+" broadly or "current stable only" to reduce testing surface.

---

## Aggregated Sources

Sources cited across all research files:

- Home Assistant Developer Documentation — Config Entries, DataUpdateCoordinator, WebSocket API, Custom Components guide
- HA Core source code — `homeassistant/components/http/__init__.py` (StaticPathConfig, async_register_static_paths)
- HA Core source code — `homeassistant/helpers/update_coordinator.py`, `aiohttp_client.py`
- Immich REST API documentation — OpenAPI spec for v1.90+ (endpoints: /api/server/ping, /api/server/statistics, /api/albums, /api/assets/{id}/thumbnail, /api/search/metadata)
- HACS Developer Documentation — manifest.json requirements, hacs.json, integration distribution checklist
- MDN Web Docs — URL.createObjectURL(), URL.revokeObjectURL(), IntersectionObserver, Fetch API with custom headers
- LitElement documentation — Custom element lifecycle, reactive properties, Shadow DOM
- HA community forum — WebSocket command patterns for custom cards, blob URL thumbnail patterns
- ha-argos-translate (prior work) — Static path registration pattern with StaticPathConfig (verified working)
