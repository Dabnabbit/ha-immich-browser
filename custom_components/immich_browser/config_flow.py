"""Config flow for Immich Browser integration."""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import API_HEADER, CONF_API_KEY, CONF_IMMICH_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_IMMICH_URL): str,
        vol.Required(CONF_API_KEY): str,
    }
)


class ImmichBrowserConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Immich Browser."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            immich_url = user_input[CONF_IMMICH_URL].rstrip("/")
            api_key = user_input[CONF_API_KEY]

            # Validate connection to Immich
            try:
                async with aiohttp.ClientSession() as session:
                    headers = {API_HEADER: api_key}
                    async with session.get(
                        f"{immich_url}/api/server/ping",
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data.get("res") != "pong":
                                errors["base"] = "cannot_connect"
                        else:
                            errors["base"] = "invalid_auth"
            except Exception:
                errors["base"] = "cannot_connect"

            if not errors:
                user_input[CONF_IMMICH_URL] = immich_url
                return self.async_create_entry(
                    title="Immich Browser",
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_SCHEMA,
            errors=errors,
        )
