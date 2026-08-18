import { LitElement, PropertyValues } from 'lit';
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
declare const DEFAULT_TIME_MODES: readonly ["latest", "now"];
type DefaultTimeMode = (typeof DEFAULT_TIME_MODES)[number];
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
export declare class MeteoSwissRadarCard extends LitElement {
    hass: HomeAssistant;
    private _config;
    private _map?;
    private _timeLabel;
    private _isPlaying;
    private _currentFrameIndex;
    private _frames;
    private _isDefaultView;
    private _isReloading;
    private _api;
    private _mapContainer?;
    private _canvasLayer?;
    private _animationInterval?;
    private _refreshInterval?;
    private _mapInitializing;
    private _renderToken;
    private _frameCache;
    static styles: import("lit").CSSResult;
    static getConfigElement(): Promise<HTMLElement>;
    static getStubConfig(): {
        type: string;
        card_title: string;
        zoom_level: number;
    };
    setConfig(config: LovelaceCardConfig): void;
    protected firstUpdated(_changedProperties: PropertyValues): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected updated(changedProperties: PropertyValues): void;
    private _initializeMap;
    private _createMap;
    private _getCenter;
    private _fetchFrames;
    private _loadData;
    private _startAutoRefresh;
    private _refreshData;
    private _pickFrameIndex;
    private _findClosestFrameIndex;
    private _renderFrame;
    private _cacheFrame;
    private _pruneFrameCache;
    private _drawRadarData;
    private _startAnimation;
    private _stopTimers;
    private _togglePlay;
    private _reload;
    private _throttledRenderFrame;
    constructor();
    private _formatTime;
    private _onSliderInput;
    private _onSliderChange;
    private _checkView;
    private _resetView;
    render(): import("lit-html").TemplateResult<1>;
    getCardSize(): number;
}
export {};
//# sourceMappingURL=meteoswiss-radar-card.d.ts.map