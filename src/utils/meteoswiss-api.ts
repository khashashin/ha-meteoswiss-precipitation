export class MeteoSwissAPI {
    private isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    // Base URL for MeteoSwiss API
    private readonly METEOSWISS_BASE = 'https://www.meteoswiss.admin.ch/product/output';

    // Shared public CORS proxy. Free tier, so it is rate limited across every
    // user of this card - configure `proxy_url` to point at your own instead.
    private readonly CORS_PROXY = 'https://corsproxy.io/?';

    // User supplied proxy template, e.g. "https://me.workers.dev/?url={url}".
    private proxyTemplate?: string;

    setProxyUrl(proxyUrl?: string): void {
        const trimmed = proxyUrl?.trim();
        this.proxyTemplate = trimmed ? trimmed : undefined;
    }

    private buildProxyUrl(url: string): string {
        const template = this.proxyTemplate ?? this.CORS_PROXY;

        // "{url}" placeholder wins; otherwise the encoded target is appended,
        // which is what corsproxy.io and most drop-in proxies expect.
        return template.includes('{url}')
            ? template.replace('{url}', encodeURIComponent(url))
            : `${template}${encodeURIComponent(url)}`;
    }

    private async fetchWithCorsProxy(url: string, cache: RequestCache = 'default'): Promise<Response> {
        // Try direct fetch first (works in local dev with proxy)
        if (this.isLocal) {
            return fetch(url.replace(this.METEOSWISS_BASE, '/product/output'), { cache });
        }

        // For production, use CORS proxy to bypass restrictions
        // This proxies the request through a CORS-enabled server
        return await fetch(this.buildProxyUrl(url), {
            cache,
            headers: {
                'Accept': 'application/json'
            }
        });
    }

    async getVersions(): Promise<Record<string, string>> {
        // The only URL here that is not immutable (MeteoSwiss serves it with
        // max-age=60), so this is the one request that must skip the HTTP cache.
        const url = `${this.METEOSWISS_BASE}/versions.json`;
        const response = await this.fetchWithCorsProxy(url, 'no-cache');

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

    // Frame URLs are timestamped and therefore immutable, and MeteoSwiss serves
    // them with max-age=86400 - let the browser HTTP cache do its job.
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
        return this.buildProxyUrl(fullUrl);
    }
}

export interface MeteoSwissRadarFrame {
    timestamp: number; // Epoch seconds
    radar_url: string;
}

export interface MeteoSwissAnimationDay {
    day: string;
    pictures: MeteoSwissRadarFrame[];
}

export interface MeteoSwissAnimationData {
    map_images: MeteoSwissAnimationDay[];
}
