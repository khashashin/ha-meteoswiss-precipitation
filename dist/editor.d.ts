import { LitElement } from 'lit';
type DefaultTimeMode = 'latest' | 'now';
interface LovelaceCardConfig {
    type: string;
    card_title?: string;
    zoom_level?: number;
    center_latitude?: number;
    center_longitude?: number;
    default_time?: DefaultTimeMode;
    proxy_url?: string;
    locale?: string;
    time_format?: '12' | '24';
}
export declare class MeteoSwissRadarCardEditor extends LitElement {
    hass?: any;
    private _config?;
    setConfig(config: LovelaceCardConfig): void;
    static styles: import("lit").CSSResult;
    protected render(): import("lit-html").TemplateResult<1>;
    private _valueChanged;
}
export {};
//# sourceMappingURL=editor.d.ts.map