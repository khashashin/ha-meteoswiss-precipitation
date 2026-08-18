import { LitElement, html, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as L from 'leaflet';
import { styles } from './styles';
import { MeteoSwissAPI, MeteoSwissRadarFrame } from './utils/meteoswiss-api';
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

// MeteoSwiss publishes a new radar frame every 5 minutes. Poll slightly more
// often so a permanently open dashboard cannot phase-lock a full frame behind.
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

// Which frame the card shows on load, and which it falls back to when the frame
// it was showing drops out of the animation window during a refresh.
const DEFAULT_TIME_MODES = ['latest', 'now'] as const;
type DefaultTimeMode = (typeof DEFAULT_TIME_MODES)[number];

// Frame JSON is immutable per timestamp, so a frame only ever needs fetching
// once. Without this the 1 fps loop re-fetches the whole window on every pass
// (~1 request/second, forever) which is what rate limits the CORS proxy.
// Frames average ~17 KB, so the cap below is a few MB of headroom over a full
// animation window.
const FRAME_CACHE_LIMIT = 400;

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
    default_time?: DefaultTimeMode;
    proxy_url?: string;
}

@customElement('meteoswiss-radar-card')
export class MeteoSwissRadarCard extends LitElement {
    @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private _config!: LovelaceCardConfig;
    @state() private _map?: L.Map;
    @state() private _timeLabel: string = 'Loading...';
    @state() private _isPlaying: boolean = true;
    @state() private _currentFrameIndex: number = 0;
    @state() private _frames: MeteoSwissRadarFrame[] = []; // Animation frames from animation.json
    @state() private _isDefaultView: boolean = true;
    @state() private _isReloading: boolean = false;

    private _api = new MeteoSwissAPI();
    private _mapContainer?: HTMLElement;
    private _canvasLayer?: L.Layer;
    private _animationInterval?: number;
    private _refreshInterval?: number;
    private _mapInitializing = false;
    private _renderToken = 0;
    private _frameCache = new Map<string, MeteoSwissRadarJSON>();

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
            zoom_level: 12
        };
    }

    setConfig(config: LovelaceCardConfig): void {
        console.log('setConfig called', config);
        if (!config) {
            throw new Error('Invalid configuration');
        }
        if (config.default_time !== undefined && !DEFAULT_TIME_MODES.includes(config.default_time)) {
            throw new Error(
                `Invalid default_time "${config.default_time}". Expected one of: ${DEFAULT_TIME_MODES.join(', ')}.`
            );
        }
        this._config = {
            zoom_level: 12,
            default_time: 'latest',
            ...config
        };
        this._api.setProxyUrl(this._config.proxy_url);

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

    public connectedCallback(): void {
        super.connectedCallback();
        // On the first connect firstUpdated() does the setup; this only covers
        // re-attach, e.g. Home Assistant moving the card between containers.
        if (!this.hasUpdated || !this._config) return;

        this._initializeMap().then(() => {
            if (this._frames.length) {
                this._renderFrame(this._currentFrameIndex);
            }
        });

        if (this._frames.length) {
            this._startAnimation();
            this._startAutoRefresh();
        }
    }

    public disconnectedCallback(): void {
        super.disconnectedCallback();
        // Without this the animation and refresh timers keep firing (and keep
        // fetching) for every card Home Assistant has ever torn down.
        this._stopTimers();
        this._map?.remove();
        this._map = undefined;
        this._canvasLayer = undefined;
    }

    protected updated(changedProperties: PropertyValues): void {
        super.updated(changedProperties);
        // Only reset view on config change OR if we are in default view and HA provides a new location (init)
        if ((changedProperties.has('_config') || changedProperties.has('hass')) && this._map) {
            if (this._isDefaultView) {
                const [lat, lng] = this._getCenter();
                const currentCenter = this._map.getCenter();

                // Check if target differs significantly from current (to avoid jitter on every hass update)
                // or if it's a config change which should force update
                const dist = Math.sqrt(
                    Math.pow(currentCenter.lat - lat, 2) +
                    Math.pow(currentCenter.lng - lng, 2)
                );

                if (changedProperties.has('_config') || dist > 0.001) {
                    this._map.setView([lat, lng], this._config.zoom_level || 12);
                    // Explicitly ensure default view is kept true
                    this._isDefaultView = true;
                }
            }
        }
    }

    private async _initializeMap(): Promise<void> {
        this._mapContainer = this.shadowRoot?.querySelector('.map-container') as HTMLElement;
        if (!this._mapContainer) return;
        if (this._map || this._mapInitializing) return;
        if (!this._config) return;

        // setConfig(), firstUpdated() and connectedCallback() can all reach this
        // method. Without this flag the await below lets a second caller past the
        // guard above and Leaflet throws "Map container is already initialized".
        this._mapInitializing = true;
        try {
            await this._createMap();
        } finally {
            this._mapInitializing = false;
        }
    }

    private async _createMap(): Promise<void> {
        if (!this._mapContainer) return;

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

    private async _fetchFrames(): Promise<MeteoSwissRadarFrame[]> {
        const versions = await this._api.getVersions();

        const accum = versions['precipitation/animation']; // Timestamp
        if (!accum) throw new Error('No animation timestamp found');

        const animationData = await this._api.getAnimationData(accum);

        // map_images is an array of day objects: [{ day: '...', pictures: [...] }, ...]
        return animationData.map_images
            .reduce<MeteoSwissRadarFrame[]>((acc, dayGroup) => acc.concat(dayGroup.pictures || []), [])
            .filter(frame => Boolean(frame.radar_url))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    private async _loadData(): Promise<void> {
        try {
            this._timeLabel = 'Fetching radar data...';
            const frames = await this._fetchFrames();

            if (!frames.length) {
                this._timeLabel = 'No radar data available';
                return;
            }

            this._frames = frames;
            this._pruneFrameCache(frames);
            this._currentFrameIndex = this._pickFrameIndex(frames);
            await this._renderFrame(this._currentFrameIndex);
            this._startAnimation();
            this._startAutoRefresh();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error('Err loading data', e);
            this._timeLabel = `Error: ${message}`;
        }
    }

    private _startAutoRefresh(): void {
        if (this._refreshInterval) clearInterval(this._refreshInterval);

        this._refreshInterval = window.setInterval(() => {
            this._refreshData();
        }, REFRESH_INTERVAL_MS);
    }

    // Pull a fresh frame list periodically. Without this a dashboard left open
    // keeps looping the window captured when the card was created, so its
    // "forecast" quietly ages into the past.
    private async _refreshData(): Promise<void> {
        try {
            const frames = await this._fetchFrames();
            if (!frames.length) return;

            const currentTimestamp = this._frames[this._currentFrameIndex]?.timestamp;
            this._frames = frames;
            this._pruneFrameCache(frames);

            // Keep the viewer on the same moment in time rather than the same
            // array index: the window slides forward, so indices shift under us.
            const preservedIndex = currentTimestamp === undefined
                ? -1
                : frames.findIndex(frame => frame.timestamp === currentTimestamp);

            if (preservedIndex >= 0) {
                // Same frame is still on screen and still valid - leave it alone.
                this._currentFrameIndex = preservedIndex;
                return;
            }

            this._currentFrameIndex = this._pickFrameIndex(frames);
            await this._renderFrame(this._currentFrameIndex);
        } catch (e) {
            // Keep showing the frames we already have; the next tick can recover.
            console.error('Radar refresh failed', e);
        }
    }

    private _pickFrameIndex(frames: MeteoSwissRadarFrame[]): number {
        if (this._config?.default_time === 'now') {
            return this._findClosestFrameIndex(frames, Date.now() / 1000);
        }
        // Default: the last frame, i.e. the end of the forecast window.
        return frames.length - 1;
    }

    private _findClosestFrameIndex(frames: MeteoSwissRadarFrame[], targetSeconds: number): number {
        let closestIndex = 0;
        let closestDiff = Infinity;

        frames.forEach((frame, index) => {
            const diff = Math.abs(frame.timestamp - targetSeconds);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = index;
            }
        });

        return closestIndex;
    }

    private async _renderFrame(index: number) {
        if (!this._frames[index]) return;
        const frame = this._frames[index];

        // The animation timer, the slider and the refresh can all have a fetch in
        // flight at once; only the most recently requested frame may draw.
        const token = ++this._renderToken;

        // Update Time Label
        this._timeLabel = this._formatTime(frame.timestamp);

        const cached = this._frameCache.get(frame.radar_url);
        if (cached) {
            this._drawRadarData(cached);
            return;
        }

        // Fetch specific Radar JSON for this frame
        // URL in animation.json is relative: /product/output/radar/rzc/radar_rzc.2025...json
        try {
            const resp = await this._api.fetchRadarFrame(frame.radar_url);
            if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
            const data: MeteoSwissRadarJSON = await resp.json();

            this._cacheFrame(frame.radar_url, data);

            if (token !== this._renderToken) return;
            this._drawRadarData(data);
        } catch (e) {
            console.error('Failed to load frame json', e);
        }
    }

    private _cacheFrame(radarUrl: string, data: MeteoSwissRadarJSON): void {
        this._frameCache.set(radarUrl, data);

        // Map preserves insertion order, so the first key is the oldest entry.
        while (this._frameCache.size > FRAME_CACHE_LIMIT) {
            const oldest = this._frameCache.keys().next().value;
            if (oldest === undefined) break;
            this._frameCache.delete(oldest);
        }
    }

    // Frames that have slid out of the animation window will never be requested
    // again, so drop them rather than waiting for the size cap to evict them.
    private _pruneFrameCache(frames: MeteoSwissRadarFrame[]): void {
        const live = new Set(frames.map(frame => frame.radar_url));

        for (const url of this._frameCache.keys()) {
            if (!live.has(url)) {
                this._frameCache.delete(url);
            }
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
            if (!this._frames.length) return;

            this._currentFrameIndex = (this._currentFrameIndex + 1) % this._frames.length;
            this._renderFrame(this._currentFrameIndex);
        }, 1000); // 1 fps
    }

    private _stopTimers(): void {
        if (this._animationInterval) {
            clearInterval(this._animationInterval);
            this._animationInterval = undefined;
        }
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = undefined;
        }
    }

    private _togglePlay() {
        this._isPlaying = !this._isPlaying;
    }

    // Manual "reload": pull a fresh frame list and restart playback from the
    // configured start frame, i.e. put the card back where a freshly created
    // card would be. Deliberately does not touch the map, so the user keeps
    // whatever they had panned/zoomed to.
    private async _reload(): Promise<void> {
        if (this._isReloading) return;

        this._isReloading = true;
        this._stopTimers();
        this._isPlaying = true;

        try {
            await this._loadData(); // re-fetches, re-picks the frame, restarts both timers
        } finally {
            this._isReloading = false;

            // _loadData() bails out before restarting the timers if the fetch
            // failed. Keep animating the frames we already have rather than
            // leaving the card frozen.
            if (this._frames.length && !this._animationInterval) {
                this._startAnimation();
                this._startAutoRefresh();
            }
        }
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
                 <button @click=${this._togglePlay} title="Play/Pause">
                    ${this._isPlaying ? '⏸' : '▶'}
                 </button>
                 <button
                    class="reload-button ${this._isReloading ? 'spinning' : ''}"
                    @click=${this._reload}
                    ?disabled=${this._isReloading}
                    title="Reload radar data and restart the animation"
                 >
                    <svg viewBox="0 0 24 24">
                        <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
                    </svg>
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
