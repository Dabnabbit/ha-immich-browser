"""Secondary DataUpdateCoordinator for the Immich Browser integration."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import ApiClient, CannotConnectError
from .const import DEFAULT_SECONDARY_SCAN_INTERVAL, DOMAIN

_LOGGER = logging.getLogger(__name__)


class TemplateSecondaryCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Secondary coordinator for slower-changing data."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the secondary coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_secondary",
            update_interval=timedelta(seconds=DEFAULT_SECONDARY_SCAN_INTERVAL),
        )
        self.config_entry = entry
        session = async_get_clientsession(hass)
        self.client = ApiClient(
            host=entry.data[CONF_HOST],
            port=entry.data[CONF_PORT],
            api_key=entry.data[CONF_API_KEY],
            session=session,
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from the service."""
        try:
            return await self.client.async_get_data()
        except CannotConnectError as err:
            raise UpdateFailed(f"Secondary coordinator error: {err}") from err
