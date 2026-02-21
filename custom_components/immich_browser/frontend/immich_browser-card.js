/**
 * Immich Browser Card
 *
 * A template Lovelace card for Home Assistant.
 * Replace this with your project-specific card implementation.
 */

const LitElement = customElements.get("hui-masonry-view")
  ? Object.getPrototypeOf(customElements.get("hui-masonry-view"))
  : Object.getPrototypeOf(customElements.get("hui-view"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const CARD_VERSION = "0.1.0";

console.info(
  `%c IMMICH-BROWSER-CARD %c v${CARD_VERSION} `,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray"
);

class ImmichBrowserCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  static getConfigElement() {
    return document.createElement("immich-browser-card-editor");
  }

  static getStubConfig(hass) {
    if (!hass) {
      return {
        header: "Immich Browser",
        entity: "",
      };
    }
    const entities = Object.keys(hass.states);
    const sensorEntity = entities.find((e) => e.startsWith("sensor."));
    return {
      header: "Immich Browser",
      entity: sensorEntity || "",
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this.config = {
      header: "Immich Browser",
      ...config,
    };
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      rows: 3,
      columns: 6,
      min_rows: 2,
      min_columns: 3,
    };
  }

  render() {
    if (!this.hass || !this.config) {
      return html`
        <ha-card>
          <div class="card-content loading">
            <ha-spinner size="small"></ha-spinner>
          </div>
        </ha-card>
      `;
    }

    const entityId = this.config.entity;

    if (!entityId) {
      return html`
        <ha-card header="${this.config.header || ""}">
          <div class="card-content">
            <div class="empty">No entity configured</div>
          </div>
        </ha-card>
      `;
    }

    const stateObj = this.hass.states[entityId];

    if (!stateObj) {
      return html`
        <ha-card header="${this.config.header || ""}">
          <div class="card-content">
            <ha-alert alert-type="error">
              Entity not available: ${entityId}
            </ha-alert>
          </div>
        </ha-card>
      `;
    }

    return html`
      <ha-card header="${this.config.header || ""}">
        <div class="card-content">
          <div class="state">
            <span class="label">${stateObj.attributes.friendly_name || entityId}</span>
            <span class="value">${stateObj.state}</span>
          </div>
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .card-content {
        padding: 0 16px 16px;
      }
      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 32px 16px;
      }
      .state {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }
      .label {
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .value {
        font-size: 1.2em;
        font-weight: bold;
        color: var(--primary-color);
      }
      .empty {
        color: var(--secondary-text-color);
        font-style: italic;
        text-align: center;
        padding: 16px;
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
    if (!this.hass || !this.config) {
      return html``;
    }

    return html`
      <div class="editor">
        <ha-textfield
          label="Header"
          .value="${this.config.header || ""}"
          @input="${this._headerChanged}"
        ></ha-textfield>
        <ha-entity-picker
          label="Entity"
          .hass="${this.hass}"
          .value="${this.config.entity || ""}"
          @value-changed="${this._entityChanged}"
          allow-custom-entity
        ></ha-entity-picker>
      </div>
    `;
  }

  _headerChanged(ev) {
    this._updateConfig("header", ev.target.value);
  }

  _entityChanged(ev) {
    this._updateConfig("entity", ev.detail.value);
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

if (!customElements.get("immich-browser-card")) {
  customElements.define(
    "immich-browser-card",
    ImmichBrowserCard
  );
}
if (!customElements.get("immich-browser-card-editor")) {
  customElements.define(
    "immich-browser-card-editor",
    ImmichBrowserCardEditor
  );
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "immich-browser-card",
  name: "Immich Browser Card",
  description: "Browse your Immich photo library from Home Assistant dashboards.",
  preview: true,
});
