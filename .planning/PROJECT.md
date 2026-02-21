# Immich Browser

## What This Is

A Home Assistant HACS integration for browsing an Immich photo library from Lovelace dashboards. Provides album browsing, recent photos, photo grid display with lightbox, and library statistics sensors — all powered by the Immich REST API.

## Core Value

Household members can browse their family photo library directly from the HA dashboard without opening a separate app — recent photos, albums, and library stats at a glance.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Config flow with Immich URL and API key, validated against /api/server/ping
- [ ] DataUpdateCoordinator polling Immich for server statistics (photos, videos, storage)
- [ ] DataUpdateCoordinator fetching album list with thumbnails
- [ ] Photos sensor (total count)
- [ ] Videos sensor (total count)
- [ ] Storage Used sensor (GB)
- [ ] Albums sensor (count)
- [ ] Lovelace card with album grid view (thumbnails + names + counts)
- [ ] Album drill-down to photo grid
- [ ] Recent photos view (most recent N assets)
- [ ] Photo grid with configurable columns
- [ ] Lightbox preview on photo click
- [ ] Video badge overlay on video assets
- [ ] Stats bar showing photo/video/storage totals
- [ ] Back navigation from photo grid to album list
- [ ] Visual card editor (URL, API key, header, columns)
- [ ] HACS-compatible distribution (hacs.json, manifest.json, GitHub Actions)
- [ ] Frontend card served via integration's static path registration
- [ ] Thumbnail loading via Immich API with API key authentication
- [ ] Lazy loading for images in grid

### Out of Scope

- Photo upload from HA — use Immich mobile app for uploads
- Photo editing/manipulation — Immich handles this
- Face recognition browsing — complex, Immich ML handles this natively
- Sharing/external links — use Immich web UI for sharing
- Timeline/map view — too complex for v1 card, use Immich web UI
- Video playback in card — complex, open in Immich instead
- Search within card — deferred to v2
- Favorites/ratings from card — deferred to v2

## Context

- **Homelab**: Immich running on QNAP at port 2283, 19,925+ photos imported from external library
- **Immich API**: Well-documented REST API with x-api-key header authentication
- **Key endpoints**: /api/server/ping, /api/server/statistics, /api/albums, /api/albums/{id}, /api/assets/{id}/thumbnail, /api/search/metadata
- **Photo source**: /share/CACHEDEV2_DATA/Pix mounted as /media/pix (read-only external library)
- **ML processing**: Face detection and CLIP embeddings running (CPU-intensive on QNAP Celeron)
- **HACS template**: Re-scaffolded from ha-hacs-template v1.0 via `copier copy` (2026-02-20). Template provides correct HA 2025.7+ patterns, CI, tests, WebSocket framework, and dual coordinator setup. All files need Immich-specific customization.
- **Copier answers**: `.copier-answers.yml` tracks template version (v1.0) and variables; `copier update` pulls future template improvements
- **Target users**: Household members browsing family photos from HA dashboards (phones, tablets, wall panels)
- **Immich mobile app**: Exists for deep photo interaction — this card is for at-a-glance browsing and quick access

## Constraints

- **Tech stack**: Python (HA integration) + JavaScript/LitElement (Lovelace card)
- **HACS compliance**: Must pass hacs/action and hassfest validation
- **No pip requirements**: aiohttp already in HA for API calls
- **Single JS file**: No build tooling, LitElement from HA's built-in instance
- **Thumbnail auth**: Immich thumbnails require API key in request — card needs direct API access (not just via coordinator)
- **Image loading**: Must be performant with 20k+ photo library — pagination and lazy loading essential
- **Card config stores API key**: Necessary for direct thumbnail fetching from browser

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Card fetches directly from Immich API | Thumbnails need browser-side HTTP requests with API key auth | — Pending |
| API key in card config | Required for browser-side thumbnail fetching; stored in HA dashboard config | — Pending |
| Album-first navigation | Natural organization, matches Immich's own UI paradigm | — Pending |
| Pagination for large albums | 20k+ photos can't load at once; fetch in pages | — Pending |
| Lightbox for preview (not full viewer) | Quick preview in card, "open in Immich" for full interaction | — Pending |

---
*Last updated: 2026-02-20 after template overlay from ha-hacs-template v1.0*
