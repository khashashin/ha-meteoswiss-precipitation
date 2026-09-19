export interface BasemapDefinition {
    name: string;
    url: string;
    attribution: string;
    maxNativeZoom: number;
    dark?: boolean;
}
export declare const BASEMAPS: Record<string, BasemapDefinition>;
export declare const DEFAULT_BASEMAP = "swisstopo-grey";
export declare const RETIRED_BASEMAPS: Set<string>;
//# sourceMappingURL=basemaps.d.ts.map