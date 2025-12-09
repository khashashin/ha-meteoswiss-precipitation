export class MeteoSwissAPI {
    private isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    // Base URL for MeteoSwiss API
    private readonly METEOSWISS_BASE = 'https://www.meteoswiss.admin.ch/product/output';

    // Public CORS proxy - can be configured
    private readonly CORS_PROXY = 'https://corsproxy.io/?';

    private async fetchWithCorsProxy(url: string): Promise<Response> {
        // Try direct fetch first (works in local dev with proxy)
        if (this.isLocal) {
            return fetch(url.replace(this.METEOSWISS_BASE, '/product/output'), {
                cache: 'no-cache'
            });
        }

        // For production, use CORS proxy to bypass restrictions
        // This proxies the request through a CORS-enabled server
        const proxyUrl = `${this.CORS_PROXY}${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl, {
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        });

        return response;
    }

    async getVersions(): Promise<Record<string, string>> {
        const url = `${this.METEOSWISS_BASE}/versions.json`;
        const response = await this.fetchWithCorsProxy(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async getAnimationData(timestamp: string): Promise<MeteoSwissAnimationData> {
        const url = `${this.METEOSWISS_BASE}/precipitation/animation/version__${timestamp}/en/animation.json`;
        const response = await this.fetchWithCorsProxy(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch animation data: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    async fetchRadarFrame(radarUrl: string): Promise<Response> {
        const fullUrl = radarUrl.startsWith('http')
            ? radarUrl
            : `https://www.meteoswiss.admin.ch${radarUrl}`;

        return this.fetchWithCorsProxy(fullUrl);
    }

    getEffectiveUrl(path: string): string {
        if (this.isLocal) {
            return path;
        }
        const fullUrl = path.startsWith('http') ? path : `https://www.meteoswiss.admin.ch${path}`;
        return `${this.CORS_PROXY}${encodeURIComponent(fullUrl)}`;
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
