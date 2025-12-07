import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as L from 'leaflet';
import { styles } from './styles';
import { MeteoSwissAPI } from './utils/meteoswiss-api';
import { decodeShape, MeteoSwissRadarJSON } from './utils/decoder';

// Types for Home Assistant
interface HomeAssistant {
    config: {
        latitude: number;
        longitude: number;
    };
}

interface LovelaceCardConfig {
    type: string;
    card_title?: string;
    zoom_level?: number;
    center_latitude?: number;
    center_longitude?: number;
}

@customElement('meteoswiss-radar-card')
export class MeteoSwissRadarCard extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private _config!: LovelaceCardConfig;
    @state() private _map?: L.Map;
    @state() private _timeLabel: string = 'Loading...';
    @state() private _isPlaying: boolean = true;
    @state() private _currentFrameIndex: number = 0;
    @state() private _frames: any[] = []; // Animation frames from animation.json

    private _api = new MeteoSwissAPI();
    private _mapContainer?: HTMLElement;
    private _canvasLayer?: L.Layer;
    private _animationInterval?: number;

    static styles = styles;

    setConfig(config: LovelaceCardConfig): void {
        console.log('setConfig called', config);
        if (!config) {
            throw new Error('Invalid configuration');
        }
        this._config = {
            zoom_level: 8,
            ...config
        };

        // Trigger data load
        this._loadData().catch(e => {
            console.error('Initial load failed', e);
            this._timeLabel = `Init Error: ${e.message}`;
        });

        // Initialize map if DOM is already ready (handles race condition)
        if (this.shadowRoot) {
            this._initializeMap();
        }
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        super.firstUpdated(_changedProperties);
        this._initializeMap();
    }

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);
        if (changedProperties.has('hass') && this.hass && !this._config?.center_latitude) {
            // Center on Home Assistant location if not configured
            if (this._map) {
                const lat = this.hass.config.latitude;
                const lng = this.hass.config.longitude;
                this._map.setView([lat, lng], this._config.zoom_level || 8);
            }
        }
    }

    private async _initializeMap(): Promise<void> {
        this._mapContainer = this.shadowRoot?.querySelector('.map-container') as HTMLElement;
        if (!this._mapContainer) return;
        if (this._map) return;
        if (!this._config) return;

        // Inject Leaflet CSS into shadow root (only once)
        if (!this.shadowRoot?.querySelector('#leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            this.shadowRoot?.prepend(link);

            // Wait for CSS to load before initializing map
            await new Promise<void>((resolve) => {
                link.onload = () => resolve();
                link.onerror = () => resolve(); // Continue even if it fails
            });
        }

        const centerLat = this._config.center_latitude || 46.8182;
        const centerLng = this._config.center_longitude || 8.2275;

        this._map = L.map(this._mapContainer, {
            center: [centerLat, centerLng],
            zoom: this._config.zoom_level || 8,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this._map);

        setTimeout(() => {
            this._map?.invalidateSize();
        }, 100);
    }

    private async _loadData(): Promise<void> {
        try {
            this._timeLabel = 'Fetching versions...';
            const versions = await this._api.getVersions();

            const accum = versions['precipitation/animation']; // Timestamp
            if (!accum) throw new Error('No animation timestamp found');

            this._timeLabel = 'Fetching animation...';
            const animationData = await this._api.getAnimationData(accum);

            // Filter for available radar frames
            // map_images is an array of day objects: [{ day: '...', pictures: [...] }, ...]
            const allFrames = animationData.map_images.reduce((acc: any[], dayGroup: any) => {
                return acc.concat(dayGroup.pictures || []);
            }, []);

            this._frames = allFrames.filter((img: any) => img.radar_url);

            if (this._frames.length > 0) {
                this._currentFrameIndex = this._frames.length - 1; // Start at latest
                this._renderFrame(this._currentFrameIndex);
                this._startAnimation();
            } else {
                this._timeLabel = 'No radar data available';
            }
        } catch (e: any) {
            console.error('Err loading data', e);
            this._timeLabel = `Error: ${e.message}`;
        }
    }

    private async _renderFrame(index: number) {
        if (!this._frames[index]) return;
        const frame = this._frames[index];

        // Update Time Label
        const date = new Date(frame.timestamp * 1000);
        this._timeLabel = date.toLocaleString();

        // Fetch specific Radar JSON for this frame
        // URL in animation.json is relative: /product/output/radar/rzc/radar_rzc.2025...json
        const jsonUrl = this._api.getEffectiveUrl(frame.radar_url);

        try {
            const resp = await fetch(jsonUrl);
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
            const data: MeteoSwissRadarJSON = await resp.json();

            this._drawRadarData(data);
        } catch (e) {
            console.error('Failed to load frame json', e);
        }
    }

    private _drawRadarData(data: MeteoSwissRadarJSON) {
        if (!this._map) return;

        // Remove old layer
        if (this._canvasLayer) {
            this._map.removeLayer(this._canvasLayer);
        }

        // Create Custom Canvas Layer (or GeoJSON as implemented)
        // @ts-ignore
        L.GridLayer.Canvas = L.GridLayer.extend({
            createTile: function (coords: any) {
                const tile = document.createElement('canvas');
                const size = this.getTileSize();
                tile.width = size.x;
                tile.height = size.y;

                const ctx = tile.getContext('2d');
                if (!ctx) return tile;
                return tile;
            }
        });

        const features: any[] = [];

        data.areas.forEach(area => {
            const color = '#' + area.color;
            area.shapes.forEach(shape => {
                const latLngs = decodeShape(shape[0], data.coords);
                // The decoder returns [lat, lng]. GeoJSON expects [lng, lat].
                const coordinates = latLngs.map(pt => [pt[1], pt[0]]);

                features.push({
                    type: "Feature",
                    properties: { color: color },
                    geometry: {
                        type: "Polygon",
                        coordinates: [coordinates]
                    }
                });
            });
        });

        const geoJsonLayer = L.geoJSON({
            type: "FeatureCollection",
            features: features
        } as any, {
            style: (feature) => ({
                fillColor: feature?.properties.color,
                weight: 0,
                fillOpacity: 0.7,
                color: 'transparent' // No border
            })
        });

        this._canvasLayer = geoJsonLayer;
        this._canvasLayer.addTo(this._map);
    }

    private _startAnimation() {
        if (this._animationInterval) clearInterval(this._animationInterval);

        this._animationInterval = window.setInterval(() => {
            if (!this._isPlaying) return;

            this._currentFrameIndex = (this._currentFrameIndex + 1) % this._frames.length;
            this._renderFrame(this._currentFrameIndex);
        }, 1000); // 1 fps
    }

    private _togglePlay() {
        this._isPlaying = !this._isPlaying;
    }

    render() {
        return html`
      <ha-card>
        ${this._config?.card_title ? html`<div class="card-header">${this._config.card_title}</div>` : ''}
        <div class="card-content">
          <div class="map-container"></div>
          <div class="time-display">${this._timeLabel}</div>
          
          <div class="controls">
             <button @click=${() => {
                this._isPlaying = false;
                this._currentFrameIndex = (this._currentFrameIndex - 1 + this._frames.length) % this._frames.length;
                this._renderFrame(this._currentFrameIndex);
            }}>
                ⏮
             </button>
             <button @click=${this._togglePlay}>
                ${this._isPlaying ? '⏸' : '▶'}
             </button>
             <button @click=${() => {
                this._isPlaying = false;
                this._currentFrameIndex = (this._currentFrameIndex + 1) % this._frames.length;
                this._renderFrame(this._currentFrameIndex);
            }}>
                ⏭
             </button>
          </div>
        </div>
      </ha-card>
        `;
    }

    getCardSize(): number {
        return 5;
    }
}

// Global registration
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'meteoswiss-radar-card',
    name: 'MeteoSwiss Precipitation Radar',
    description: 'Official MeteoSwiss Precipitation Radar',
});
