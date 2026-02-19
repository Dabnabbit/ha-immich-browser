/**
 * Immich Browser Card
 *
 * A Lovelace card for browsing Immich photos and albums
 * directly from a Home Assistant dashboard.
 */

const LitElement = customElements.get("hui-masonry-view")
  ? Object.getPrototypeOf(customElements.get("hui-masonry-view"))
  : Object.getPrototypeOf(customElements.get("hui-view"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const CARD_VERSION = "0.1.0";

console.info(
  `%c IMMICH-BROWSER-CARD %c v${CARD_VERSION} `,
  "color: lime; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

class ImmichBrowserCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _view: { type: String },
      _albums: { type: Array },
      _assets: { type: Array },
      _selectedAlbum: { type: Object },
      _loading: { type: Boolean },
      _lightboxAsset: { type: Object },
    };
  }

  constructor() {
    super();
    this._view = "albums";
    this._albums = [];
    this._assets = [];
    this._selectedAlbum = null;
    this._loading = false;
    this._lightboxAsset = null;
  }

  static getConfigElement() {
    return document.createElement("immich-browser-card-editor");
  }

  static getStubConfig() {
    return {
      header: "Photo Browser",
      immich_url: "",
      api_key: "",
      columns: 4,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this.config = {
      header: "Photo Browser",
      columns: 4,
      ...config,
    };
  }

  getCardSize() {
    return 6;
  }

  render() {
    if (!this.hass || !this.config) return html``;

    return html`
      <ha-card header="${this.config.header}">
        <div class="card-content">
          <div class="toolbar">
            ${this._view === "photos"
              ? html`
                  <button class="back-btn" @click="${this._goToAlbums}">
                    &larr; Albums
                  </button>
                  <span class="album-name">
                    ${this._selectedAlbum
                      ? this._selectedAlbum.name
                      : "Recent Photos"}
                  </span>
                `
              : html`
                  <button
                    class="view-btn ${this._view === "albums" ? "active" : ""}"
                    @click="${() => (this._view = "albums")}"
                  >
                    Albums
                  </button>
                  <button
                    class="view-btn ${this._view === "recent" ? "active" : ""}"
                    @click="${this._loadRecent}"
                  >
                    Recent
                  </button>
                `}
          </div>

          ${this._loading
            ? html`<div class="loading">Loading...</div>`
            : this._view === "albums"
              ? this._renderAlbums()
              : this._renderPhotoGrid()}

          ${this._renderStats()}
        </div>
      </ha-card>

      ${this._lightboxAsset
        ? html`
            <div class="lightbox" @click="${this._closeLightbox}">
              <img
                src="${this._getThumbnailUrl(this._lightboxAsset.id, "preview")}"
                alt="${this._lightboxAsset.original_file_name}"
              />
            </div>
          `
        : ""}
    `;
  }

  _renderAlbums() {
    if (this._albums.length === 0) {
      return html`<div class="empty">No albums found. Configure Immich URL and API key in the card editor.</div>`;
    }

    return html`
      <div class="album-grid" style="--columns: ${this.config.columns}">
        ${this._albums.map(
          (album) => html`
            <div class="album-item" @click="${() => this._openAlbum(album)}">
              <div class="album-thumb">
                ${album.thumbnail_id
                  ? html`<img
                      src="${this._getThumbnailUrl(album.thumbnail_id)}"
                      alt="${album.name}"
                      loading="lazy"
                    />`
                  : html`<div class="no-thumb">
                      <ha-icon icon="mdi:folder-image"></ha-icon>
                    </div>`}
              </div>
              <div class="album-info">
                <div class="album-title">${album.name}</div>
                <div class="album-count">${album.count} items</div>
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  _renderPhotoGrid() {
    if (this._assets.length === 0) {
      return html`<div class="empty">No photos found</div>`;
    }

    return html`
      <div class="photo-grid" style="--columns: ${this.config.columns}">
        ${this._assets.map(
          (asset) => html`
            <div class="photo-item" @click="${() => this._openLightbox(asset)}">
              <img
                src="${this._getThumbnailUrl(asset.id)}"
                alt="${asset.original_file_name}"
                loading="lazy"
              />
              ${asset.type === "VIDEO"
                ? html`<div class="video-badge">
                    <ha-icon icon="mdi:play-circle"></ha-icon>
                  </div>`
                : ""}
            </div>
          `
        )}
      </div>
    `;
  }

  _renderStats() {
    const entities = Object.keys(this.hass.states).filter((e) =>
      e.startsWith("sensor.immich_browser")
    );

    if (entities.length === 0) return html``;

    const photoEntity = entities.find((e) => e.endsWith("_photos"));
    const videoEntity = entities.find((e) => e.endsWith("_videos"));
    const storageEntity = entities.find((e) => e.endsWith("_storage_used"));

    return html`
      <div class="stats-bar">
        ${photoEntity
          ? html`<span>${this.hass.states[photoEntity].state} photos</span>`
          : ""}
        ${videoEntity
          ? html`<span>${this.hass.states[videoEntity].state} videos</span>`
          : ""}
        ${storageEntity
          ? html`<span>${this.hass.states[storageEntity].state} GB</span>`
          : ""}
      </div>
    `;
  }

  updated(changedProperties) {
    if (changedProperties.has("config") && this.config) {
      this._loadAlbums();
    }
  }

  async _loadAlbums() {
    if (!this.config.immich_url || !this.config.api_key) {
      // Try to get from integration data via sensors
      // Albums will come from coordinator data
      this._albums = [];
      return;
    }

    this._loading = true;
    try {
      const resp = await fetch(`${this.config.immich_url}/api/albums`, {
        headers: { "x-api-key": this.config.api_key },
      });
      if (resp.ok) {
        const albums = await resp.json();
        this._albums = albums.map((a) => ({
          id: a.id,
          name: a.albumName || "Untitled",
          count: a.assetCount || 0,
          thumbnail_id: a.albumThumbnailAssetId,
        }));
      }
    } catch (err) {
      console.error("Failed to load albums:", err);
    } finally {
      this._loading = false;
    }
  }

  async _openAlbum(album) {
    this._selectedAlbum = album;
    this._view = "photos";
    this._loading = true;

    try {
      const resp = await fetch(
        `${this.config.immich_url}/api/albums/${album.id}`,
        { headers: { "x-api-key": this.config.api_key } }
      );
      if (resp.ok) {
        const data = await resp.json();
        this._assets = (data.assets || []).map((a) => ({
          id: a.id,
          type: a.type || "IMAGE",
          original_file_name: a.originalFileName || "",
          created_at: a.fileCreatedAt || "",
        }));
      }
    } catch (err) {
      console.error("Failed to load album:", err);
    } finally {
      this._loading = false;
    }
  }

  async _loadRecent() {
    this._view = "photos";
    this._selectedAlbum = null;
    this._loading = true;

    try {
      const resp = await fetch(
        `${this.config.immich_url}/api/search/metadata`,
        {
          method: "POST",
          headers: {
            "x-api-key": this.config.api_key,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ size: 50, order: "desc" }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const items = data.assets?.items || [];
        this._assets = items.map((a) => ({
          id: a.id,
          type: a.type || "IMAGE",
          original_file_name: a.originalFileName || "",
          created_at: a.fileCreatedAt || "",
        }));
      }
    } catch (err) {
      console.error("Failed to load recent:", err);
    } finally {
      this._loading = false;
    }
  }

  _goToAlbums() {
    this._view = "albums";
    this._assets = [];
    this._selectedAlbum = null;
  }

  _getThumbnailUrl(assetId, size = "thumbnail") {
    return `${this.config.immich_url}/api/assets/${assetId}/${size}?key=${this.config.api_key}`;
  }

  _openLightbox(asset) {
    this._lightboxAsset = asset;
  }

  _closeLightbox() {
    this._lightboxAsset = null;
  }

  static get styles() {
    return css`
      ha-card {
        padding: 16px;
        overflow: hidden;
      }
      .card-content {
        padding: 0 16px 16px;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }
      .back-btn {
        padding: 6px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        background: transparent;
        color: var(--primary-color);
        cursor: pointer;
        font-size: 13px;
      }
      .album-name {
        font-weight: 600;
        color: var(--primary-text-color);
      }
      .view-btn {
        padding: 6px 16px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        font-size: 13px;
      }
      .view-btn.active {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
      }
      .loading {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }
      .empty {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
        font-style: italic;
      }

      /* Album grid */
      .album-grid {
        display: grid;
        grid-template-columns: repeat(var(--columns, 4), 1fr);
        gap: 12px;
      }
      .album-item {
        cursor: pointer;
        border-radius: 8px;
        overflow: hidden;
        background: var(--secondary-background-color);
        transition: transform 0.2s;
      }
      .album-item:hover {
        transform: scale(1.02);
      }
      .album-thumb {
        aspect-ratio: 1;
        overflow: hidden;
      }
      .album-thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .no-thumb {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--secondary-background-color);
        color: var(--secondary-text-color);
        --mdc-icon-size: 32px;
      }
      .album-info {
        padding: 8px;
      }
      .album-title {
        font-weight: 500;
        font-size: 13px;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .album-count {
        font-size: 11px;
        color: var(--secondary-text-color);
      }

      /* Photo grid */
      .photo-grid {
        display: grid;
        grid-template-columns: repeat(var(--columns, 4), 1fr);
        gap: 4px;
        max-height: 500px;
        overflow-y: auto;
      }
      .photo-item {
        aspect-ratio: 1;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        border-radius: 4px;
      }
      .photo-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.2s;
      }
      .photo-item:hover img {
        transform: scale(1.05);
      }
      .video-badge {
        position: absolute;
        bottom: 4px;
        right: 4px;
        color: white;
        --mdc-icon-size: 20px;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
      }

      /* Stats bar */
      .stats-bar {
        display: flex;
        justify-content: space-around;
        padding-top: 12px;
        margin-top: 12px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      /* Lightbox */
      .lightbox {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        cursor: pointer;
      }
      .lightbox img {
        max-width: 90vw;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 4px;
      }
    `;
  }
}

/**
 * Card Editor
 */
class ImmichBrowserCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  setConfig(config) {
    this.config = config;
  }

  render() {
    if (!this.hass || !this.config) return html``;

    return html`
      <div class="editor">
        <ha-textfield
          label="Header"
          .value="${this.config.header || ""}"
          @input="${(ev) => this._updateConfig("header", ev.target.value)}"
        ></ha-textfield>
        <ha-textfield
          label="Immich URL (e.g. http://192.168.1.100:2283)"
          .value="${this.config.immich_url || ""}"
          @input="${(ev) => this._updateConfig("immich_url", ev.target.value)}"
        ></ha-textfield>
        <ha-textfield
          label="API Key"
          type="password"
          .value="${this.config.api_key || ""}"
          @input="${(ev) => this._updateConfig("api_key", ev.target.value)}"
        ></ha-textfield>
        <ha-textfield
          label="Columns (default: 4)"
          type="number"
          .value="${String(this.config.columns || 4)}"
          @input="${(ev) =>
            this._updateConfig("columns", parseInt(ev.target.value) || 4)}"
        ></ha-textfield>
      </div>
    `;
  }

  _updateConfig(key, value) {
    if (!this.config) return;
    const newConfig = { ...this.config, [key]: value };
    const event = new CustomEvent("config-changed", {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  static get styles() {
    return css`
      .editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }
    `;
  }
}

customElements.define("immich-browser-card", ImmichBrowserCard);
customElements.define("immich-browser-card-editor", ImmichBrowserCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "immich-browser-card",
  name: "Immich Browser Card",
  description: "Browse and view Immich photos and albums",
  preview: true,
});
