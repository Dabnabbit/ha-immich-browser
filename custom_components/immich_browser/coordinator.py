"""DataUpdateCoordinator for Immich Browser."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import API_HEADER, CONF_API_KEY, CONF_IMMICH_URL, DEFAULT_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)


class ImmichBrowserCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage Immich API data fetching."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=DEFAULT_SCAN_INTERVAL),
        )
        self.config_entry = entry
        self._immich_url = entry.data[CONF_IMMICH_URL]
        self._api_key = entry.data[CONF_API_KEY]
        self._headers = {API_HEADER: self._api_key}

    @property
    def immich_url(self) -> str:
        """Return the Immich server URL."""
        return self._immich_url

    @property
    def api_key(self) -> str:
        """Return the API key."""
        return self._api_key

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch statistics and albums from Immich."""
        data: dict[str, Any] = {
            "photos": 0,
            "videos": 0,
            "usage_bytes": 0,
            "albums": [],
        }

        try:
            async with aiohttp.ClientSession() as session:
                # Fetch server statistics
                async with session.get(
                    f"{self._immich_url}/api/server/statistics",
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        stats = await resp.json()
                        # Stats may be in usageByUser array
                        usage = stats.get("usageByUser", [])
                        for user in usage:
                            data["photos"] += user.get("photos", 0)
                            data["videos"] += user.get("videos", 0)
                            data["usage_bytes"] += user.get("usage", 0)

                # Fetch albums
                async with session.get(
                    f"{self._immich_url}/api/albums",
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        albums = await resp.json()
                        data["albums"] = [
                            {
                                "id": a["id"],
                                "name": a.get("albumName", "Untitled"),
                                "count": a.get("assetCount", 0),
                                "thumbnail_id": a.get("albumThumbnailAssetId"),
                            }
                            for a in albums
                        ]

        except Exception as err:
            raise UpdateFailed(f"Error communicating with Immich: {err}") from err

        return data

    async def async_get_album_assets(
        self, album_id: str, page: int = 1, per_page: int = 50
    ) -> list[dict[str, Any]]:
        """Fetch assets from a specific album."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self._immich_url}/api/albums/{album_id}",
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        album = await resp.json()
                        assets = album.get("assets", [])
                        # Simple pagination
                        start = (page - 1) * per_page
                        end = start + per_page
                        return [
                            {
                                "id": a["id"],
                                "type": a.get("type", "IMAGE"),
                                "original_file_name": a.get("originalFileName", ""),
                                "created_at": a.get("fileCreatedAt", ""),
                            }
                            for a in assets[start:end]
                        ]
        except Exception:
            _LOGGER.warning("Failed to fetch album %s", album_id)
        return []

    async def async_get_recent_assets(self, count: int = 20) -> list[dict[str, Any]]:
        """Fetch the most recent assets."""
        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "size": count,
                    "order": "desc",
                }
                async with session.post(
                    f"{self._immich_url}/api/search/metadata",
                    headers=self._headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        items = data.get("assets", {}).get("items", [])
                        return [
                            {
                                "id": a["id"],
                                "type": a.get("type", "IMAGE"),
                                "original_file_name": a.get("originalFileName", ""),
                                "created_at": a.get("fileCreatedAt", ""),
                            }
                            for a in items
                        ]
        except Exception:
            _LOGGER.warning("Failed to fetch recent assets")
        return []

    def get_thumbnail_url(self, asset_id: str) -> str:
        """Build a thumbnail URL for an asset."""
        return f"{self._immich_url}/api/assets/{asset_id}/thumbnail"
