export declare class MeteoSwissAPI {
    private readonly HA_PROXY_BASE;
    private fetchViaHAProxy;
    getVersions(): Promise<Record<string, string>>;
    getAnimationData(timestamp: string): Promise<MeteoSwissAnimationData>;
    fetchRadarFrame(radarUrl: string): Promise<Response>;
    getEffectiveUrl(path: string): string;
}
interface MeteoSwissAnimationData {
    map_images: Array<{
        day: string;
        pictures: Array<{
            timestamp: number;
            radar_url: string;
        }>;
    }>;
}
export {};
//# sourceMappingURL=meteoswiss-api.d.ts.map