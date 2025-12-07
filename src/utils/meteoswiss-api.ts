export class MeteoSwissAPI {
    private isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    // When local, use relative path so http-server proxy handles it.
    // When remote, use absolute path.
    private baseUrl = this.isLocal
        ? '/product/output'
        : 'https://www.meteoswiss.admin.ch/product/output';

    async getVersions(): Promise<any> {
        const url = `${this.baseUrl}/versions.json`;

        const response = await fetch(url, {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch versions: ${response.statusText}`);
        }
        return response.json();
    }

    async getAnimationData(timestamp: string): Promise<any> {
        const url = `${this.baseUrl}/precipitation/animation/version__${timestamp}/en/animation.json`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch animation data: ${response.statusText}`);
        }
        return response.json();
    }

    getEffectiveUrl(path: string): string {
        return this.isLocal ? path : `https://www.meteoswiss.admin.ch${path}`;
    }
}
