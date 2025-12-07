export declare class MeteoSwissAPI {
    private isLocal;
    private baseUrl;
    getVersions(): Promise<any>;
    getAnimationData(timestamp: string): Promise<any>;
    getEffectiveUrl(path: string): string;
}
//# sourceMappingURL=meteoswiss-api.d.ts.map