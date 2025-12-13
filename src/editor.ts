import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface LovelaceCardConfig {
    type: string;
    card_title?: string;
    zoom_level?: number;
    center_latitude?: number;
    center_longitude?: number;
}

@customElement('meteoswiss-radar-card-editor')
export class MeteoSwissRadarCardEditor extends LitElement {
    @property({ attribute: false }) public hass?: any;
    @state() private _config?: LovelaceCardConfig;

    public setConfig(config: LovelaceCardConfig): void {
        this._config = config;
    }

    static styles = css`
        .card-config {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .option {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        label {
            font-weight: 500;
        }
        input {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
    `;

    protected render() {
        if (!this.hass || !this._config) {
            return html``;
        }

        return html`
            <div class="card-config">
                <div class="option">
                    <label>Card Title (Optional)</label>
                    <input
                        type="text"
                        .value=${this._config.card_title || ''}
                        @input=${this._valueChanged}
                        .configValue=${'card_title'}
                    />
                </div>
                <div class="option">
                    <label>Zoom Level (Default: 12)</label>
                    <input
                        type="number"
                        .value=${this._config.zoom_level || 12}
                        @input=${this._valueChanged}
                        .configValue=${'zoom_level'}
                    />
                </div>
                <div class="option">
                    <label>Center Latitude (Optional)</label>
                    <input
                        type="number"
                        step="0.0001"
                        .value=${this._config.center_latitude || this.hass.config.latitude}
                        @input=${this._valueChanged}
                        .configValue=${'center_latitude'}
                    />
                </div>
                <div class="option">
                    <label>Center Longitude (Optional)</label>
                    <input
                        type="number"
                        step="0.0001"
                        .value=${this._config.center_longitude || this.hass.config.longitude}
                        @input=${this._valueChanged}
                        .configValue=${'center_longitude'}
                    />
                </div>
            </div>
        `;
    }

    private _valueChanged(ev: Event): void {
        if (!this._config || !this.hass) {
            return;
        }
        const target = ev.target as any;
        const configValue = target.configValue as keyof LovelaceCardConfig; // Fixed: cast to keyof LovelaceCardConfig
        const value = target.value;

        // @ts-ignore
        if (this._config[configValue] === value) {
            return;
        }

        let newValue: number | string | undefined = value;
        if (configValue === 'zoom_level' || configValue === 'center_latitude' || configValue === 'center_longitude') {
            newValue = value === '' ? undefined : Number(value);
        }

        this._config = {
            ...this._config,
            [configValue]: newValue,
        };

        const event = new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true,
            composed: true,
        });
        this.dispatchEvent(event);
    }
}
