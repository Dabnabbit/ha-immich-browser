# Immich Browser

A Home Assistant HACS integration for browsing your [Immich](https://immich.app/) photo library directly from a Lovelace dashboard. View albums, browse photos, and see library statistics without leaving Home Assistant.

## Features

- Browse Immich albums with thumbnails
- View recent photos
- Photo grid with lightbox preview
- Library statistics sensors (photos, videos, storage, albums)
- Configurable grid columns
- Config flow with Immich server validation
- Visual card editor

## Installation

### HACS (Recommended)

1. Add this repository as a custom repository in HACS
2. Search for "Immich Browser" and install
3. Restart Home Assistant
4. Add the integration via Settings > Devices & Services

### Manual

1. Copy `custom_components/immich_browser/` to your HA `config/custom_components/`
2. Restart Home Assistant
3. Add the integration via Settings > Devices & Services

## Configuration

### Integration Setup

The config flow asks for:

- **Immich URL**: Your Immich server URL (e.g. `http://192.168.1.100:2283`)
- **API Key**: Generate one in Immich under User Settings > API Keys

### Card Configuration

Add the card to a dashboard and configure:

- **Header**: Card title (default: "Photo Browser")
- **Immich URL**: Same as integration config
- **API Key**: Same as integration config (needed for direct thumbnail access)
- **Columns**: Grid columns (default: 4)

## Sensors

| Sensor | Description |
|--------|-------------|
| `sensor.immich_browser_*_photos` | Total photo count |
| `sensor.immich_browser_*_videos` | Total video count |
| `sensor.immich_browser_*_storage_used` | Storage usage in GB |
| `sensor.immich_browser_*_albums` | Number of albums |

## Card Features

- **Album View**: Browse albums with thumbnail previews and item counts
- **Recent View**: See your most recent photos
- **Photo Grid**: Responsive grid with configurable columns
- **Lightbox**: Click any photo to view it larger
- **Video Badges**: Video assets show a play icon overlay
- **Stats Bar**: Photo/video/storage counts at the bottom

## License

MIT
