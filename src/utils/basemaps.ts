export interface BasemapDefinition {
    name: string; // label in the layer selector
    url: string;
    attribution: string;
    // Highest zoom the provider actually serves. Above this Leaflet upscales the
    // last real tile instead of requesting one the service answers with 400.
    maxNativeZoom: number;
    // Darkens the out-of-Switzerland mask so it still reads as a mask.
    dark?: boolean;
}

const SWISSTOPO_ATTRIBUTION =
    '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener">swisstopo</a>';

// Every provider here works with no API key and no registration - the bar CARTO
// stopped clearing when it began stamping "API KEY REQUIRED" across its tiles.
// Verified zoom ceilings: swisstopo grey/colour and OSM stop at 19, swissimage
// and the Esri dark canvas serve 20.
export const BASEMAPS: Record<string, BasemapDefinition> = {
    'swisstopo-grey': {
        name: 'swisstopo Grey',
        url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/{z}/{x}/{y}.jpeg',
        attribution: SWISSTOPO_ATTRIBUTION,
        maxNativeZoom: 19
    },
    'swisstopo-color': {
        name: 'swisstopo Colour',
        url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
        attribution: SWISSTOPO_ATTRIBUTION,
        maxNativeZoom: 19
    },
    'swisstopo-aerial': {
        name: 'swisstopo Aerial',
        url: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',
        attribution: SWISSTOPO_ATTRIBUTION,
        maxNativeZoom: 20,
        dark: true
    },
    'osm': {
        name: 'OpenStreetMap',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxNativeZoom: 19
    },
    'dark': {
        name: 'Dark',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>',
        maxNativeZoom: 20,
        dark: true
    }
};

export const DEFAULT_BASEMAP = 'swisstopo-grey';
