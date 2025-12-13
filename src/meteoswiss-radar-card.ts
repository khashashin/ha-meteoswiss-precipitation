import { LitElement, html, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as L from 'leaflet';
import { styles } from './styles';
import { MeteoSwissAPI } from './utils/meteoswiss-api';
import { decodeShape, MeteoSwissRadarJSON } from './utils/decoder';
import { throttle } from './utils/throttle';
import { SWISS_BOUNDARY_GEOJSON } from './utils/switzerland-boundary';


// Declare custom card for Home Assistant UI
declare global {
    interface Window {
        customCards: Array<{
            type: string;
            name: string;
            description: string;
            preview?: boolean;
        }>;
    }
}

if (!customElements.get('meteoswiss-radar-card')) {
    window.customCards = window.customCards || [];
    window.customCards.push({
        type: 'meteoswiss-radar-card',
        name: 'MeteoSwiss Radar',
        description: 'A responsive weather radar card for Switzerland with high-resolution masking.',
        preview: false,
    });
}

// Types for Home Assistant
interface HomeAssistant {
    language: string;
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
    @state() private _isDefaultView: boolean = true;

    private _api = new MeteoSwissAPI();
    private _mapContainer?: HTMLElement;
    private _canvasLayer?: L.Layer;
    private _animationInterval?: number;

    static styles = styles;

    public static async getConfigElement() {
        console.log('getConfigElement called for MeteoSwissRadarCard');
        await import('./editor');
        return document.createElement('meteoswiss-radar-card-editor');
    }

    public static getStubConfig() {
        return {
            type: 'custom:meteoswiss-radar-card',
            card_title: 'MeteoSwiss Radar',
            zoom_level: 12,
            center_latitude: 46.8182,
            center_longitude: 8.2275
        };
    }

    setConfig(config: LovelaceCardConfig): void {
        console.log('setConfig called', config);
        if (!config) {
            throw new Error('Invalid configuration');
        }
        this._config = {
            zoom_level: 12,
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
        // Only reset view on config change (e.g. editor), NOT on every hass update
        if (changedProperties.has('_config') && this._map) {
            const [lat, lng] = this._getCenter();
            this._map.setView([lat, lng], this._config.zoom_level || 12);
            this._isDefaultView = true;
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

        const [centerLat, centerLng] = this._getCenter();

        // 1. Initialize Map with Constraints
        this._map = L.map(this._mapContainer, {
            center: [centerLat, centerLng],
            zoom: this._config.zoom_level || 12,
            minZoom: 7,
            maxZoom: 21,
            maxBounds: [
                [45.3, 5.0], // Southwest (padding around CH)
                [48.3, 11.0] // Northeast
            ],
            maxBoundsViscosity: 1.0
        });

        // Track View State
        this._map.on('moveend zoomend', () => this._checkView());

        // 2. Base Layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 21
        }).addTo(this._map);

        // 3. Add Inverse Mask (Grey out non-Swiss areas)
        // Note: SWISS_BOUNDARY_COORDINATES is Array<Ring>, where Ring is Array<[Lng, Lat]>
        // Note: SWISS_BOUNDARY_GEOJSON is a FeatureCollection. We take the first feature's polygon.
        const coordinates = SWISS_BOUNDARY_GEOJSON.features[0].geometry.coordinates;

        // coordinates is Array<Ring>, where Ring is Array<[Lng, Lat]>
        const swissRings = coordinates.map(ring =>
            ring.map(pt => [pt[1], pt[0]] as [number, number])
        );

        // World Polygon (Outer)
        const worldCoords = [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180]
        ] as [number, number][];

        // Create Polygon with hole (Leaflet takes arrays of coordinates: [OuterRing, InnerHole1, ...])
        // We cast to any to avoid TypeScript limitations with complex nested arrays in Leaflet typings
        L.polygon([worldCoords, ...swissRings] as any, {
            color: 'transparent',
            fillColor: '#888888',
            fillOpacity: 0.5,
            interactive: false // Click-through
        }).addTo(this._map);

        setTimeout(() => {
            this._map?.invalidateSize();
        }, 100);
    }

    private _getCenter(): [number, number] {
        // 1. Config override
        if (this._config.center_latitude && this._config.center_longitude) {
            return [this._config.center_latitude, this._config.center_longitude];
        }

        // 2. Home Assistant Config
        if (this.hass && this.hass.config && this.hass.config.latitude && this.hass.config.longitude) {
            return [this.hass.config.latitude, this.hass.config.longitude];
        }

        // 3. Default (Swiss Center - approximate)
        return [46.8182, 8.2275];
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
        this._timeLabel = this._formatTime(frame.timestamp);

        // Fetch specific Radar JSON for this frame
        // URL in animation.json is relative: /product/output/radar/rzc/radar_rzc.2025...json
        try {
            const resp = await this._api.fetchRadarFrame(frame.radar_url);
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

    private _throttledRenderFrame: (index: number) => void;

    constructor() {
        super();
        // Initialize throttled function (250ms limit)
        this._throttledRenderFrame = throttle((index: number) => {
            this._renderFrame(index);
        }, 250);
    }

    private _formatTime(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        const lang = this.hass?.language || 'en-CH'; // Default
        return new Intl.DateTimeFormat(lang, {
            weekday: 'long',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(date);
    }

    private _onSliderInput(e: Event) {
        const input = e.target as HTMLInputElement;
        this._isPlaying = false; // Pause while dragging
        const index = parseInt(input.value);
        this._currentFrameIndex = index;

        // Immediate UI feedback (Time Update)
        if (this._frames[index]) {
            this._timeLabel = this._formatTime(this._frames[index].timestamp);
        }

        // Throttled Network Request
        this._throttledRenderFrame(index);
    }

    private _onSliderChange(e: Event) {
        // Optional: Resume playing if it was playing before?
        // For now, keep it paused to let user examine the frame.
    }

    private _checkView() {
        if (!this._map || !this._config) return;

        const [defaultLat, defaultLng] = this._getCenter();
        const defaultZoom = this._config.zoom_level || 12;

        const currentCenter = this._map.getCenter();
        const currentZoom = this._map.getZoom();

        const latDiff = Math.abs(currentCenter.lat - defaultLat);
        const lngDiff = Math.abs(currentCenter.lng - defaultLng);
        const zoomDiff = Math.abs(currentZoom - defaultZoom);

        // Threshold to consider "moved"
        const isMoved = latDiff > 0.005 || lngDiff > 0.005 || zoomDiff > 0.5;
        this._isDefaultView = !isMoved;
    }

    private _resetView() {
        if (!this._map || !this._config) return;
        const [lat, lng] = this._getCenter();
        this._map.flyTo([lat, lng], this._config.zoom_level || 12);
    }

    render() {
        return html`
      <ha-card>
        <div class="card-content">
          <div class="map-wrapper">
            <div class="map-container"></div>
            <button 
                class="reset-button ${this._isDefaultView ? 'hidden' : ''}" 
                @click=${this._resetView}
                title="Reset View"
            >
                <svg viewBox="0 0 24 24">
                    <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
                </svg>
            </button>
          </div>
          
          <div class="controls">
             <div class="time-label">${this._timeLabel}</div>
             <div class="controls-row">
                 <button @click=${this._togglePlay}>
                    ${this._isPlaying ? '⏸' : '▶'}
                 </button>
                 <input 
                    type="range" 
                    .min=${0} 
                    .max=${this._frames.length - 1} 
                    .value=${this._currentFrameIndex}
                    @input=${this._onSliderInput}
                    @change=${this._onSliderChange}
                 >
             </div>
          </div>
        </div>
      </ha-card>
        `;
    }

    getCardSize(): number {
        return 5;
    }
}
