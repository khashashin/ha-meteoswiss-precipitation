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
export declare class MeteoSwissRadarCard extends LitElement {
    hass: HomeAssistant;
    private _config;
    private _map?;
    private _timeLabel;
    private _isPlaying;
    private _currentFrameIndex;
    private _frames;
    private _api;
    private _mapContainer?;
    private _canvasLayer?;
    private _animationInterval?;
    static styles: import("lit").CSSResult;
    setConfig(config: LovelaceCardConfig): void;
    protected firstUpdated(_changedProperties: PropertyValues): void;
    protected updated(changedProperties: PropertyValues): void;
    private _initializeMap;
    private _getCenter;
    private _loadData;
    private _renderFrame;
    private _drawRadarData;
    private _startAnimation;
    private _togglePlay;
    private _throttledRenderFrame;
    constructor();
    private _formatTime;
    private _onSliderInput;
    private _onSliderChange;
    render(): import("lit-html").TemplateResult<1>;
    getCardSize(): number;
}
export {};
//# sourceMappingURL=meteoswiss-radar-card.d.ts.map