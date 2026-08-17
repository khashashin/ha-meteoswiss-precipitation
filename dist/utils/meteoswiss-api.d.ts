export declare class MeteoSwissAPI {
    private isLocal;
    private readonly METEOSWISS_BASE;
    private readonly CORS_PROXY;
    private proxyTemplate?;
    setProxyUrl(proxyUrl?: string): void;
    private buildProxyUrl;
    private fetchWithCorsProxy;
    getVersions(): Promise<Record<string, string>>;
    getAnimationData(timestamp: string): Promise<MeteoSwissAnimationData>;
    fetchRadarFrame(radarUrl: string): Promise<Response>;
    getEffectiveUrl(path: string): string;
}
export interface MeteoSwissRadarFrame {
    timestamp: number;
    radar_url: string;
}
export interface MeteoSwissAnimationDay {
    day: string;
    pictures: MeteoSwissRadarFrame[];
}
export interface MeteoSwissAnimationData {
    map_images: MeteoSwissAnimationDay[];
}
//# sourceMappingURL=meteoswiss-api.d.ts.map