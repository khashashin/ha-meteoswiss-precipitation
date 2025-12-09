export declare class MeteoSwissAPI {
    private isLocal;
    private readonly METEOSWISS_BASE;
    private readonly CORS_PROXY;
    private fetchWithCorsProxy;
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