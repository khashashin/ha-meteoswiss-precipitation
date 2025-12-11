import { LitElement } from 'lit';
interface LovelaceCardConfig {
    type: string;
    card_title?: string;
    zoom_level?: number;
    center_latitude?: number;
    center_longitude?: number;
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