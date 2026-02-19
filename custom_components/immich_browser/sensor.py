"""Sensor platform for Immich Browser."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfInformation
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ImmichBrowserCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensor entities."""
    coordinator: ImmichBrowserCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities(
        [
            ImmichPhotosSensor(coordinator, entry),
            ImmichVideosSensor(coordinator, entry),
            ImmichStorageSensor(coordinator, entry),
            ImmichAlbumsSensor(coordinator, entry),
        ]
    )


class ImmichPhotosSensor(CoordinatorEntity[ImmichBrowserCoordinator], SensorEntity):
    """Sensor showing the total photo count."""

    _attr_has_entity_name = True
    _attr_name = "Photos"
    _attr_icon = "mdi:image-multiple"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: ImmichBrowserCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_photos"

    @property
    def native_value(self) -> int | None:
        """Return the photo count."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("photos")


class ImmichVideosSensor(CoordinatorEntity[ImmichBrowserCoordinator], SensorEntity):
    """Sensor showing the total video count."""

    _attr_has_entity_name = True
    _attr_name = "Videos"
    _attr_icon = "mdi:video-outline"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: ImmichBrowserCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_videos"

    @property
    def native_value(self) -> int | None:
        """Return the video count."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("videos")


class ImmichStorageSensor(CoordinatorEntity[ImmichBrowserCoordinator], SensorEntity):
    """Sensor showing total storage usage in GB."""

    _attr_has_entity_name = True
    _attr_name = "Storage Used"
    _attr_icon = "mdi:harddisk"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_native_unit_of_measurement = UnitOfInformation.GIGABYTES
    _attr_suggested_display_precision = 1

    def __init__(self, coordinator: ImmichBrowserCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_storage"

    @property
    def native_value(self) -> float | None:
        """Return storage in GB."""
        if self.coordinator.data is None:
            return None
        usage_bytes = self.coordinator.data.get("usage_bytes", 0)
        return round(usage_bytes / (1024**3), 1)


class ImmichAlbumsSensor(CoordinatorEntity[ImmichBrowserCoordinator], SensorEntity):
    """Sensor showing the total album count."""

    _attr_has_entity_name = True
    _attr_name = "Albums"
    _attr_icon = "mdi:folder-multiple-image"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: ImmichBrowserCoordinator, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_albums"

    @property
    def native_value(self) -> int | None:
        """Return the album count."""
        if self.coordinator.data is None:
            return None
        return len(self.coordinator.data.get("albums", []))
