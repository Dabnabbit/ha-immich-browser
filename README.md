# Immich Browser

Browse your Immich photo library from Home Assistant dashboards.

[![HACS Default](https://img.shields.io/badge/HACS-Default-blue.svg)](https://github.com/hacs/integration)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2025.7%2B-blue.svg)](https://www.home-assistant.io/)

## Installation via HACS

1. Open HACS in Home Assistant
2. Go to Integrations
3. Search for "Immich Browser"
4. Install and restart Home Assistant

## Manual Installation

1. Copy `custom_components/immich_browser/` into your HA `config/custom_components/`
2. Restart Home Assistant
3. Add the integration via Settings > Devices & Services > Add Integration

## Card Usage

Add the Lovelace card to your dashboard:

```yaml
type: custom:immich-browser-card
entity: sensor.example
header: "Immich Browser"
```

## Configuration

Configure the integration via Settings > Devices & Services > Add Integration > Immich Browser.

## Links

- [Documentation](https://github.com/Dabentz/ha-immich-browser)
- [Issues](https://github.com/Dabentz/ha-immich-browser/issues)

## License

MIT
