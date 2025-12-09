export class MeteoSwissAPI {
    // Use Home Assistant's backend proxy for all requests
    // This integration provides /api/meteoswiss/* endpoint that proxies to MeteoSwiss
    private readonly HA_PROXY_BASE = '/api/meteoswiss';

    private async fetchViaHAProxy(path: string): Promise<Response> {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        // Construct URL through HA proxy
        const proxyUrl = `${this.HA_PROXY_BASE}/${cleanPath}`;

        const response = await fetch(proxyUrl, {
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        });

        return response;
    }

    async getVersions(): Promise<Record<string, string>> {
        const response = await this.fetchViaHAProxy('versions.json');

        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getAnimationData(timestamp: string): Promise<MeteoSwissAnimationData> {
        const path = `precipitation/animation/version__${timestamp}/en/animation.json`;
        const response = await this.fetchViaHAProxy(path);

        if (!response.ok) {
            throw new Error(`Failed to fetch animation data: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async fetchRadarFrame(radarUrl: string): Promise<Response> {
        // radarUrl is typically like: /product/output/radar/rzc/radar_rzc.2025...json
        // Extract the path after /product/output/
        const path = radarUrl.replace(/^\/product\/output\//, '').replace(/^https?:\/\/[^/]+\/product\/output\//, '');
        return this.fetchViaHAProxy(path);
    }

    getEffectiveUrl(path: string): string {
        // Not used anymore, but keep for compatibility
        const cleanPath = path.replace(/^\/product\/output\//, '').replace(/^https?:\/\/[^/]+\/product\/output\//, '');
        return `${this.HA_PROXY_BASE}/${cleanPath}`;
    }
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
