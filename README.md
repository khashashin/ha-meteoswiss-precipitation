# MeteoSwiss Precipitation Radar Widget for Home Assistant

A comprehensive guide to creating a custom Lovelace card that replicates the MeteoSwiss Precipitation Radar functionality with animated precipitation forecasting.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Implementation Guide](#implementation-guide)
- [Data Sources](#data-sources)
- [HACS Distribution](#hacs-distribution)
- [Configuration Options](#configuration-options)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

## Overview

This widget aims to replicate the functionality of the [MeteoSwiss Precipitation Radar](https://www.meteoswiss.admin.ch/services-and-publications/applications/precipitation.html), which provides:

- Real-time precipitation radar data for Switzerland
- Animated precipitation forecasts for the next 4-6 hours
- Interactive map with zoom and pan capabilities
- Time-based playback controls

## Features

- **Animated Radar Loop**: Display past and forecasted precipitation data
- **Interactive Map**: Pan and zoom functionality using Leaflet.js
- **Playback Controls**: Play, pause, step forward/backward through frames
- **Location Marker**: Show your home location on the map
- **Customizable Appearance**: Multiple map styles and color schemes
- **HACS Compatible**: Easy installation through Home Assistant Community Store

## Prerequisites

Before starting development, ensure you have:

1. **Home Assistant Instance**: Running version 2023.1 or later
2. **Development Environment**:
   - Node.js (v16 or later)
   - npm or yarn
   - Git
3. **Text Editor/IDE**: VS Code recommended with the following extensions:
   - ESLint
   - Prettier
   - lit-plugin (for Lit Element development)
4. **Basic Knowledge**:
   - JavaScript/TypeScript
   - Web Components / Custom Elements
   - Home Assistant Lovelace architecture

## Project Structure

```
meteoswiss-radar-card/
├── .devcontainer/           # VS Code dev container configuration
├── .github/
│   └── workflows/           # GitHub Actions for CI/CD
├── dist/                    # Compiled output
├── src/
│   ├── meteoswiss-radar-card.ts    # Main card component
│   ├── editor.ts                    # Card configuration editor
│   ├── types.ts                     # TypeScript type definitions
│   ├── styles.ts                    # CSS styles
│   ├── utils/
│   │   ├── api.ts                   # MeteoSwiss API client
│   │   ├── map.ts                   # Map utilities
│   │   └── animation.ts             # Animation controller
│   └── localize/
│       └── languages/               # Translations
├── elements/                # Static assets (icons, images)
├── package.json
├── rollup.config.js         # Build configuration
├── tsconfig.json
├── hacs.json                # HACS manifest
└── README.md
```

## Development Setup

### 1. Initialize the Project

```bash
# Create project directory
mkdir meteoswiss-radar-card
cd meteoswiss-radar-card

# Initialize npm project
npm init -y

# Install dependencies
npm install --save-dev typescript rollup @rollup/plugin-typescript \
  @rollup/plugin-node-resolve @rollup/plugin-commonjs \
  rollup-plugin-terser @rollup/plugin-json eslint prettier

# Install runtime dependencies
npm install lit leaflet
npm install --save-dev @types/leaflet
```

### 2. Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3. Configure Rollup Build

Create `rollup.config.js`:

```javascript
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import json from '@rollup/plugin-json';

const dev = process.env.ROLLUP_WATCH;

export default {
  input: 'src/meteoswiss-radar-card.ts',
  output: {
    file: 'dist/meteoswiss-radar-card.js',
    format: 'es',
    sourcemap: dev ? true : false,
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript(),
    !dev && terser(),
  ],
};
```

### 4. Update package.json Scripts

```json
{
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c --watch",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

## Implementation Guide

### Step 1: Create the Main Card Component

Create `src/meteoswiss-radar-card.ts`:

```typescript
import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as L from 'leaflet';
import { HomeAssistant, LovelaceCardConfig } from './types';
import { MeteoSwissAPI } from './utils/api';
import { AnimationController } from './utils/animation';

interface MeteoSwissRadarCardConfig extends LovelaceCardConfig {
  card_title?: string;
  center_latitude?: number;
  center_longitude?: number;
  marker_latitude?: number;
  marker_longitude?: number;
  zoom_level?: number;
  frame_count?: number;
  frame_delay?: number;
  show_marker?: boolean;
  show_playback?: boolean;
  show_zoom?: boolean;
  show_scale?: boolean;
  map_style?: string;
}

@customElement('meteoswiss-radar-card')
export class MeteoSwissRadarCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: MeteoSwissRadarCardConfig;
  @state() private _map?: L.Map;
  @state() private _radarLayers: L.ImageOverlay[] = [];
  @state() private _currentFrame: number = 0;
  @state() private _isPlaying: boolean = true;
  
  private _api!: MeteoSwissAPI;
  private _animationController!: AnimationController;
  private _mapContainer?: HTMLElement;
  
  // Default configuration
  private static readonly DEFAULT_CONFIG: Partial<MeteoSwissRadarCardConfig> = {
    zoom_level: 8,
    frame_count: 12,
    frame_delay: 500,
    show_marker: true,
    show_playback: true,
    show_zoom: true,
    show_scale: true,
    map_style: 'light',
    // Default to center of Switzerland
    center_latitude: 46.8182,
    center_longitude: 8.2275,
  };

  static get styles() {
    return css`
      :host {
        display: block;
      }
      
      ha-card {
        height: 100%;
        overflow: hidden;
      }
      
      .card-content {
        height: calc(100% - 52px);
      }
      
      .map-container {
        width: 100%;
        height: 400px;
        min-height: 300px;
        position: relative;
        border-radius: 8px;
        overflow: hidden;
      }
      
      .controls {
        position: absolute;
        bottom: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        gap: 8px;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .controls button {
        border: none;
        background: #1976d2;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .controls button:hover {
        background: #1565c0;
      }
      
      .controls button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
      
      .time-display {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .legend {
        position: absolute;
        bottom: 60px;
        right: 10px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      
      .legend img {
        height: 150px;
      }
      
      /* Leaflet overrides */
      .leaflet-container {
        height: 100%;
        width: 100%;
        border-radius: 8px;
      }
    `;
  }

  setConfig(config: MeteoSwissRadarCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    
    this._config = {
      ...MeteoSwissRadarCard.DEFAULT_CONFIG,
      ...config,
    };
    
    // Initialize API client
    this._api = new MeteoSwissAPI();
    
    // Initialize animation controller
    this._animationController = new AnimationController(
      this._config.frame_delay!,
      this._config.frame_count!,
      (frame: number) => this._showFrame(frame)
    );
  }

  protected firstUpdated(_changedProperties: PropertyValues): void {
    super.firstUpdated(_changedProperties);
    this._initializeMap();
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    
    if (changedProperties.has('hass') && this.hass && !this._config.center_latitude) {
      // Use Home Assistant's location as default
      this._config = {
        ...this._config,
        center_latitude: this.hass.config.latitude,
        center_longitude: this.hass.config.longitude,
        marker_latitude: this.hass.config.latitude,
        marker_longitude: this.hass.config.longitude,
      };
      
      if (this._map) {
        this._map.setView(
          [this._config.center_latitude!, this._config.center_longitude!],
          this._config.zoom_level
        );
      }
    }
  }

  private async _initializeMap(): Promise<void> {
    this._mapContainer = this.shadowRoot?.querySelector('.map-container') as HTMLElement;
    
    if (!this._mapContainer) return;
    
    // Create map
    this._map = L.map(this._mapContainer, {
      center: [this._config.center_latitude!, this._config.center_longitude!],
      zoom: this._config.zoom_level,
      zoomControl: this._config.show_zoom,
    });
    
    // Add base tile layer
    const tileUrl = this._getTileUrl(this._config.map_style!);
    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this._map);
    
    // Add scale if enabled
    if (this._config.show_scale) {
      L.control.scale({ position: 'bottomleft' }).addTo(this._map);
    }
    
    // Add home marker if enabled
    if (this._config.show_marker) {
      const markerLat = this._config.marker_latitude || this._config.center_latitude!;
      const markerLng = this._config.marker_longitude || this._config.center_longitude!;
      
      L.marker([markerLat, markerLng], {
        icon: L.divIcon({
          className: 'home-marker',
          html: '<ha-icon icon="mdi:home"></ha-icon>',
          iconSize: [24, 24],
        }),
      }).addTo(this._map);
    }
    
    // Load radar data
    await this._loadRadarData();
    
    // Start animation
    if (this._isPlaying) {
      this._animationController.start();
    }
  }

  private _getTileUrl(style: string): string {
    const styles: Record<string, string> = {
      light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    };
    
    return styles[style] || styles.light;
  }

  private async _loadRadarData(): Promise<void> {
    try {
      const radarData = await this._api.getRadarFrames(this._config.frame_count!);
      
      // Clear existing layers
      this._radarLayers.forEach(layer => {
        if (this._map) this._map.removeLayer(layer);
      });
      this._radarLayers = [];
      
      // Switzerland bounds (approximate)
      const bounds: L.LatLngBoundsExpression = [
        [45.8, 5.9],  // Southwest
        [47.8, 10.5]  // Northeast
      ];
      
      // Create overlay layers for each frame
      for (const frame of radarData.frames) {
        const overlay = L.imageOverlay(frame.url, bounds, {
          opacity: 0,
          interactive: false,
        });
        
        overlay.addTo(this._map!);
        this._radarLayers.push(overlay);
      }
      
      // Show first frame
      if (this._radarLayers.length > 0) {
        this._showFrame(0);
      }
    } catch (error) {
      console.error('Failed to load radar data:', error);
    }
  }

  private _showFrame(frameIndex: number): void {
    this._currentFrame = frameIndex;
    
    // Hide all frames
    this._radarLayers.forEach((layer, index) => {
      layer.setOpacity(index === frameIndex ? 0.7 : 0);
    });
    
    this.requestUpdate();
  }

  private _togglePlayback(): void {
    this._isPlaying = !this._isPlaying;
    
    if (this._isPlaying) {
      this._animationController.start();
    } else {
      this._animationController.stop();
    }
    
    this.requestUpdate();
  }

  private _stepForward(): void {
    this._animationController.stop();
    this._isPlaying = false;
    
    const nextFrame = (this._currentFrame + 1) % this._radarLayers.length;
    this._showFrame(nextFrame);
  }

  private _stepBackward(): void {
    this._animationController.stop();
    this._isPlaying = false;
    
    const prevFrame = (this._currentFrame - 1 + this._radarLayers.length) % this._radarLayers.length;
    this._showFrame(prevFrame);
  }

  private _getFrameTime(): string {
    // Calculate time for current frame
    const now = new Date();
    const frameOffset = this._currentFrame - Math.floor(this._config.frame_count! / 2);
    const frameTime = new Date(now.getTime() + frameOffset * 5 * 60 * 1000);
    
    return frameTime.toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  render() {
    if (!this._config) {
      return html`<ha-card>Invalid configuration</ha-card>`;
    }

    return html`
      <ha-card>
        <div class="card-content">
          <div class="map-container">
            <div class="time-display">
              ${this._getFrameTime()}
              ${this._currentFrame < Math.floor(this._config.frame_count! / 2)
                ? ' (Past)'
                : this._currentFrame > Math.floor(this._config.frame_count! / 2)
                ? ' (Forecast)'
                : ' (Now)'}
            </div>
            
            ${this._config.show_playback
              ? html`
                  <div class="controls">
                    <button @click=${this._stepBackward} title="Previous frame">
                      ⏮
                    </button>
                    <button @click=${this._togglePlayback} title="${this._isPlaying ? 'Pause' : 'Play'}">
                      ${this._isPlaying ? '⏸' : '▶'}
                    </button>
                    <button @click=${this._stepForward} title="Next frame">
                      ⏭
                    </button>
                  </div>
                `
              : ''}
            
            <div class="legend">
              <img src="/local/community/meteoswiss-radar-card/precipitation-legend.png" 
                   alt="Precipitation Legend" />
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  // Card size for Lovelace layout
  getCardSize(): number {
    return 5;
  }

  // Grid options for sections view
  getGridOptions() {
    return {
      rows: 5,
      columns: 12,
      min_rows: 4,
      max_rows: 8,
    };
  }

  // Configuration editor
  static getConfigElement() {
    return document.createElement('meteoswiss-radar-card-editor');
  }

  // Default stub configuration
  static getStubConfig() {
    return {
      card_title: 'Precipitation Radar',
      zoom_level: 8,
      frame_count: 12,
      show_marker: true,
      show_playback: true,
    };
  }
}

// Register card in Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'meteoswiss-radar-card',
  name: 'MeteoSwiss Precipitation Radar',
  description: 'A precipitation radar card showing animated weather data from MeteoSwiss',
  preview: true,
  documentationURL: 'https://github.com/your-username/meteoswiss-radar-card',
});

declare global {
  interface HTMLElementTagNameMap {
    'meteoswiss-radar-card': MeteoSwissRadarCard;
  }
  
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description?: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}
```

### Step 2: Create the API Client

Create `src/utils/api.ts`:

```typescript
export interface RadarFrame {
  timestamp: number;
  url: string;
  type: 'past' | 'nowcast';
}

export interface RadarData {
  frames: RadarFrame[];
  generated: number;
}

export class MeteoSwissAPI {
  // RainViewer API (global coverage including Switzerland)
  private readonly RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
  
  // MeteoSwiss Open Data STAC API (when available)
  private readonly METEOSWISS_STAC = 'https://data.geo.admin.ch/api/stac/v1';

  async getRadarFrames(frameCount: number = 12): Promise<RadarData> {
    try {
      // Try RainViewer first (more accessible)
      return await this._fetchRainViewerData(frameCount);
    } catch (error) {
      console.error('RainViewer API failed:', error);
      
      // Fallback to MeteoSwiss if available
      try {
        return await this._fetchMeteoSwissData(frameCount);
      } catch (meteoError) {
        console.error('MeteoSwiss API failed:', meteoError);
        throw new Error('Failed to fetch radar data from all sources');
      }
    }
  }

  private async _fetchRainViewerData(frameCount: number): Promise<RadarData> {
    const response = await fetch(this.RAINVIEWER_API);
    
    if (!response.ok) {
      throw new Error(`RainViewer API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Get past frames
    const pastFrames = (data.radar?.past || [])
      .slice(-Math.floor(frameCount / 2))
      .map((frame: any) => ({
        timestamp: frame.time * 1000,
        url: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        type: 'past' as const,
      }));
    
    // Get nowcast (forecast) frames
    const nowcastFrames = (data.radar?.nowcast || [])
      .slice(0, Math.ceil(frameCount / 2))
      .map((frame: any) => ({
        timestamp: frame.time * 1000,
        url: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        type: 'nowcast' as const,
      }));
    
    return {
      frames: [...pastFrames, ...nowcastFrames],
      generated: data.generated * 1000,
    };
  }

  private async _fetchMeteoSwissData(frameCount: number): Promise<RadarData> {
    // MeteoSwiss Open Data implementation
    // Note: This requires accessing the STAC API and HDF5 files
    // The exact implementation depends on the available endpoints
    
    const collectionUrl = `${this.METEOSWISS_STAC}/collections/ch.meteoswiss.radar.precip/items`;
    
    const response = await fetch(`${collectionUrl}?limit=${frameCount}`);
    
    if (!response.ok) {
      throw new Error(`MeteoSwiss API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const frames: RadarFrame[] = data.features.map((feature: any) => ({
      timestamp: new Date(feature.properties.datetime).getTime(),
      url: feature.assets?.data?.href || '',
      type: 'past' as const,
    }));
    
    return {
      frames,
      generated: Date.now(),
    };
  }
}
```

### Step 3: Create the Animation Controller

Create `src/utils/animation.ts`:

```typescript
export class AnimationController {
  private _frameDelay: number;
  private _frameCount: number;
  private _onFrameChange: (frame: number) => void;
  private _currentFrame: number = 0;
  private _intervalId?: number;
  private _isRunning: boolean = false;

  constructor(
    frameDelay: number,
    frameCount: number,
    onFrameChange: (frame: number) => void
  ) {
    this._frameDelay = frameDelay;
    this._frameCount = frameCount;
    this._onFrameChange = onFrameChange;
  }

  start(): void {
    if (this._isRunning) return;
    
    this._isRunning = true;
    this._intervalId = window.setInterval(() => {
      this._currentFrame = (this._currentFrame + 1) % this._frameCount;
      this._onFrameChange(this._currentFrame);
    }, this._frameDelay);
  }

  stop(): void {
    if (!this._isRunning) return;
    
    this._isRunning = false;
    if (this._intervalId !== undefined) {
      window.clearInterval(this._intervalId);
      this._intervalId = undefined;
    }
  }

  setFrame(frame: number): void {
    this._currentFrame = Math.max(0, Math.min(frame, this._frameCount - 1));
    this._onFrameChange(this._currentFrame);
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  destroy(): void {
    this.stop();
  }
}
```

### Step 4: Create Type Definitions

Create `src/types.ts`:

```typescript
export interface HomeAssistant {
  config: {
    latitude: number;
    longitude: number;
    unit_system: {
      length: string;
      temperature: string;
    };
  };
  states: Record<string, HassEntity>;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, any>
  ) => Promise<void>;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: any;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: LovelaceCardConfig): void;
  getCardSize?(): number | Promise<number>;
}
```

### Step 5: Create the Configuration Editor

Create `src/editor.ts`:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant } from './types';

@customElement('meteoswiss-radar-card-editor')
export class MeteoSwissRadarCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config: any = {};

  static get styles() {
    return css`
      .form-row {
        margin-bottom: 16px;
      }
      
      .form-row label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
      }
      
      .form-row input,
      .form-row select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
      }
      
      .form-row input[type="checkbox"] {
        width: auto;
        margin-right: 8px;
      }
      
      .checkbox-row {
        display: flex;
        align-items: center;
      }
    `;
  }

  setConfig(config: any): void {
    this._config = config;
  }

  private _valueChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement | HTMLSelectElement;
    const configValue = target.type === 'checkbox' 
      ? (target as HTMLInputElement).checked 
      : target.type === 'number' 
        ? parseFloat(target.value) 
        : target.value;
    
    const newConfig = {
      ...this._config,
      [target.name]: configValue,
    };
    
    this._config = newConfig;
    
    const event = new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <div class="form">
        <div class="form-row">
          <label for="card_title">Card Title</label>
          <input
            type="text"
            id="card_title"
            name="card_title"
            .value=${this._config.card_title || ''}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="zoom_level">Zoom Level (4-10)</label>
          <input
            type="number"
            id="zoom_level"
            name="zoom_level"
            min="4"
            max="10"
            .value=${this._config.zoom_level || 8}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="center_latitude">Center Latitude</label>
          <input
            type="number"
            id="center_latitude"
            name="center_latitude"
            step="0.0001"
            .value=${this._config.center_latitude || ''}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="center_longitude">Center Longitude</label>
          <input
            type="number"
            id="center_longitude"
            name="center_longitude"
            step="0.0001"
            .value=${this._config.center_longitude || ''}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="frame_count">Number of Frames</label>
          <input
            type="number"
            id="frame_count"
            name="frame_count"
            min="6"
            max="48"
            .value=${this._config.frame_count || 12}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="frame_delay">Frame Delay (ms)</label>
          <input
            type="number"
            id="frame_delay"
            name="frame_delay"
            min="100"
            max="2000"
            step="100"
            .value=${this._config.frame_delay || 500}
            @input=${this._valueChanged}
          />
        </div>
        
        <div class="form-row">
          <label for="map_style">Map Style</label>
          <select
            id="map_style"
            name="map_style"
            @change=${this._valueChanged}
          >
            <option value="light" ?selected=${this._config.map_style === 'light'}>Light</option>
            <option value="dark" ?selected=${this._config.map_style === 'dark'}>Dark</option>
            <option value="voyager" ?selected=${this._config.map_style === 'voyager'}>Voyager</option>
            <option value="satellite" ?selected=${this._config.map_style === 'satellite'}>Satellite</option>
          </select>
        </div>
        
        <div class="form-row checkbox-row">
          <input
            type="checkbox"
            id="show_marker"
            name="show_marker"
            ?checked=${this._config.show_marker !== false}
            @change=${this._valueChanged}
          />
          <label for="show_marker">Show Home Marker</label>
        </div>
        
        <div class="form-row checkbox-row">
          <input
            type="checkbox"
            id="show_playback"
            name="show_playback"
            ?checked=${this._config.show_playback !== false}
            @change=${this._valueChanged}
          />
          <label for="show_playback">Show Playback Controls</label>
        </div>
        
        <div class="form-row checkbox-row">
          <input
            type="checkbox"
            id="show_zoom"
            name="show_zoom"
            ?checked=${this._config.show_zoom !== false}
            @change=${this._valueChanged}
          />
          <label for="show_zoom">Show Zoom Controls</label>
        </div>
        
        <div class="form-row checkbox-row">
          <input
            type="checkbox"
            id="show_scale"
            name="show_scale"
            ?checked=${this._config.show_scale !== false}
            @change=${this._valueChanged}
          />
          <label for="show_scale">Show Scale</label>
        </div>
      </div>
    `;
  }
}
```

## Data Sources

### Primary: RainViewer API

RainViewer provides global precipitation radar data with good coverage of Switzerland.

**API Endpoint**: `https://api.rainviewer.com/public/weather-maps.json`

**Features**:
- 5-minute update interval
- Past frames (up to 2 hours)
- Nowcast/forecast frames (up to 2 hours)
- Multiple color schemes
- Tile-based delivery (compatible with Leaflet)

### Secondary: MeteoSwiss Open Data

MeteoSwiss is gradually releasing Open Government Data including radar products.

**STAC API**: `https://data.geo.admin.ch/api/stac/v1`

**Available Products**:
- Radar-based Precipitation (5min intervals)
- Combined Precipitation (CombiPrecip)
- Hail products (POH, MESHS)

**Data Format**: HDF5 in Swiss LV95/EPSG:2056 coordinate system

**Note**: Direct API access is planned for 2026. Currently, data is available via bulk download.

## HACS Distribution

### 1. Create hacs.json

```json
{
  "name": "MeteoSwiss Precipitation Radar",
  "render_readme": true,
  "filename": "meteoswiss-radar-card.js"
}
```

### 2. Create GitHub Release

1. Build the production version:
   ```bash
   npm run build
   ```

2. Create a release on GitHub with:
   - Tag: `v1.0.0`
   - Release title: `MeteoSwiss Radar Card v1.0.0`
   - Attach `dist/meteoswiss-radar-card.js`

### 3. Add to HACS Default Repository (Optional)

Submit a PR to the [HACS default repository](https://github.com/hacs/default) to include your card.

### 4. Manual Installation Instructions

For users without HACS:

1. Download `meteoswiss-radar-card.js` from the latest release
2. Copy to `config/www/community/meteoswiss-radar-card/`
3. Add resource in Lovelace:
   ```yaml
   resources:
     - url: /local/community/meteoswiss-radar-card/meteoswiss-radar-card.js
       type: module
   ```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | **Required** | Must be `custom:meteoswiss-radar-card` |
| `card_title` | string | - | Card header title |
| `center_latitude` | number | HA location | Map center latitude |
| `center_longitude` | number | HA location | Map center longitude |
| `marker_latitude` | number | center | Home marker latitude |
| `marker_longitude` | number | center | Home marker longitude |
| `zoom_level` | number | 8 | Initial zoom (4-10) |
| `frame_count` | number | 12 | Animation frames |
| `frame_delay` | number | 500 | Delay between frames (ms) |
| `show_marker` | boolean | true | Show home marker |
| `show_playback` | boolean | true | Show playback controls |
| `show_zoom` | boolean | true | Show zoom controls |
| `show_scale` | boolean | true | Show map scale |
| `map_style` | string | 'light' | Map style (light/dark/voyager/satellite) |

### Example Configuration

```yaml
type: custom:meteoswiss-radar-card
card_title: Precipitation Radar
center_latitude: 47.3769
center_longitude: 8.5417
zoom_level: 9
frame_count: 18
frame_delay: 400
show_marker: true
show_playback: true
map_style: voyager
```

## Troubleshooting

### Common Issues

1. **Map not displaying**
   - Check browser console for errors
   - Verify Leaflet CSS is loaded
   - Ensure map container has defined height

2. **Radar data not loading**
   - Check network requests in browser dev tools
   - Verify CORS is not blocking API requests
   - Try alternative data source

3. **Animation stuttering**
   - Reduce frame count
   - Increase frame delay
   - Check device performance

4. **Card not appearing in picker**
   - Clear browser cache
   - Refresh Lovelace resources
   - Check for JavaScript errors

### Debug Mode

Add `debug: true` to configuration to enable verbose logging:

```yaml
type: custom:meteoswiss-radar-card
debug: true
```

## Resources

### Official Documentation

- [Home Assistant Developer Docs - Custom Cards](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/)
- [MeteoSwiss Open Data](https://www.meteoswiss.admin.ch/services-and-publications/service/open-data.html)
- [MeteoSwiss Open Data Documentation](https://opendatadocs.meteoswiss.ch/)

### Libraries Used

- [Lit](https://lit.dev/) - Web Components library
- [Leaflet](https://leafletjs.com/) - Interactive maps
- [RainViewer API](https://www.rainviewer.com/api.html) - Radar data

### Similar Projects

- [weather-radar-card](https://github.com/Makin-Things/weather-radar-card) - RainViewer-based radar card
- [simple-weather-card](https://github.com/kalkih/simple-weather-card) - Minimalist weather card

### Community

- [Home Assistant Community Forums](https://community.home-assistant.io/)
- [Home Assistant Discord](https://discord.gg/c5DvZ4e)
- [HACS Discord](https://discord.gg/apgchf8)

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Acknowledgments

- MeteoSwiss for providing open weather data
- RainViewer for their excellent API
- Home Assistant community for inspiration and support