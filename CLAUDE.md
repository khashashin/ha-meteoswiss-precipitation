# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a two-part Home Assistant project for displaying MeteoSwiss precipitation radar data:

1. **Custom Integration** (`custom_components/meteoswiss_precipitation/`) - Python backend that proxies MeteoSwiss API requests
2. **Lovelace Card** (`src/`, `dist/`) - TypeScript/Lit Web Component for visualization with Leaflet maps

The integration solves CORS issues by running server-side in Home Assistant, while the card handles interactive visualization.

## Build Commands

- **Install dependencies**: `npm install`
- **Development server**: `npm start` - Starts http-server at http://127.0.0.1:8080 with MeteoSwiss proxy
- **Watch mode**: `npm run watch` - Automatically rebuilds on file changes
- **Production build**: `npm run build` - Outputs to `dist/meteoswiss-radar-card.js`
- **Lint**: `npm run lint`
- **Format**: `npm run format`

## Architecture

### Entry Point
- `src/meteoswiss-radar-card.ts` - Main LitElement custom element that registers as `meteoswiss-radar-card`

### Core Components
1. **LitElement Component** (`MeteoSwissRadarCard`):
   - Manages Home Assistant integration via `hass` property
   - Handles configuration via `setConfig()`
   - Renders Leaflet map in shadow DOM
   - Manages animation state and frame playback

2. **MeteoSwiss API Client** (`src/utils/meteoswiss-api.ts`):
   - Fetches `versions.json` to get latest data timestamps
   - Fetches `animation.json` with frame metadata
   - Handles local dev proxy vs production URLs
   - **CORS is still enforced by MeteoSwiss** (verified: no `Access-Control-Allow-Origin` on `product/output/*`, `OPTIONS` returns 405), so a proxy is mandatory in production
   - **`corsproxy.io` (the historical default) is dead**: it retired anonymous access and returns `403 keyless_legacy_url` for every request, so `proxy_url` is now effectively required. `describeFailure()` turns a 403/429 on the shared proxy into an actionable message instead of a bare status code
   - `{url}` placeholder in `proxy_url` is substituted with the encoded target, otherwise the encoded target is appended
   - `needsProxyConfig()` (no `proxy_url` and not local dev) short-circuits `_loadData()`: the card sets `_needsProxySetup` and renders the setup notice over the map instead of firing a doomed request. Re-evaluated on every load, so saving a `proxy_url` in the editor clears it
   - Known edge: `isLocal` is hostname-based, so a browser pointed at `http://localhost:8123` is treated as the dev server and gets same-origin 404s rather than the setup notice
   - Only `versions.json` uses `cache: 'no-cache'` (`max-age=60`). Animation and frame URLs are timestamped/immutable (`max-age=86400`) and must use the default HTTP cache — forcing `no-cache` on those is what generated ~1 request/second

3. **Data Decoder** (`src/utils/decoder.ts`):
   - Decodes MeteoSwiss proprietary radar shape format
   - Chain code decoding: `d` string uses charCode - 77 for deltas
   - `o` string contains fine-grained offsets (0.1 + 0.05 precision)
   - Converts Swiss LV95 (CH1903+) coordinates to WGS84 lat/lng
   - Critical: Input coordinates in JSON are in kilometers, multiply by 1000 for meter-based projection formulas

4. **Switzerland Boundary** (`src/utils/switzerland-boundary.ts`):
   - Contains GeoJSON for Swiss boundaries
   - Used to create inverse mask (grey overlay outside Switzerland)
   - Implemented as world polygon with Swiss boundary as hole

### Key Technical Details

**Coordinate Systems**:
- MeteoSwiss data uses Swiss LV95 (CH1903+) coordinate system
- Grid coordinates in JSON are in kilometers (e.g., x_min: 255.5)
- Must multiply by 1000 before converting to WGS84
- Conversion formula requires LV95 input (y ~2.6M, x ~1.2M)
- Heuristic: if y < 2M, add 2M; if x < 1M, add 1M

**Shape Decoding Algorithm**:
- Each shape has: `i` (row), `j` (col), `d` (direction chain), `o` (offset string), `l` (level)
- Iterate through `o` string: each char represents 0.1 precision offset + 0.05
- Even/odd row logic determines which axis gets the offset
- `d` string updates grid position: pairs of chars, each char - 77 ('M') = delta

**Leaflet Integration**:
- Base maps live in `src/utils/basemaps.ts` (`BASEMAPS`, `DEFAULT_BASEMAP`), shared by the card and the editor — keep it a separate module, since a static import from `editor.ts` back into the card would be a cycle (the card imports the editor dynamically)
- All five providers are keyless and unregistered by design. **CARTO was dropped because it now stamps "API KEY REQUIRED" across its keyless tiles** (both `light_all` and `dark_all`), and Stadia/Stamen dark maps require a key
- `maxNativeZoom` per layer is measured, not assumed: swisstopo grey/colour and OSM stop at 19, SWISSIMAGE and the Esri dark canvas at 20. The map keeps `maxZoom: 21` so Leaflet upscales rather than requesting tiles that 400
- **Do not raise the Esri ceiling on a 200 alone**: at z21 `World_Dark_Gray_Base` answers `200 image/jpeg` with an identical 2521-byte grey "Map data not yet available" placeholder at every location. Check tile bytes/contents, not just the status
- `_applyMaskStyle()` darkens the non-Swiss veil (`#000` @ 0.6 instead of `#888` @ 0.5) on layers flagged `dark: true` (aerial and dark), where a light grey veil disappears
- Layer selection: `L.control.layers` at `bottomright` (topleft is Leaflet's zoom control, topright is the card's reset button). `baselayerchange` records the pick in `_activeBasemap`, which survives detach/re-attach; `_setBasemap()` handles a `basemap` change made in the config editor and Leaflet's control follows the layeradd/layerremove events
- Map initialization must wait for external CSS to load (unpkg.com)
- Renders in shadow DOM, requires CSS injection
- Uses maxBounds to constrain view to Switzerland region
- Radar data rendered as GeoJSON layers, replaced each frame
- **Palette**: the two halves of the animation ship different colours. INCA forecast frames already use the official palette from `animation.json`'s `legend` block (what the MeteoSwiss app shows); observed radar (RZC) frames use a washed out variant. `OFFICIAL_COLORS` snaps the observed colours onto the legend. Key on **colour, not on the shapes' `l` field** — `l` indexes each frame's own area list, not a global band, so the same colour appears under different levels across frames (`#49ff36` → levels 2 and 3, `#faca1e` → 2, 4 and 5). Colours absent from the table pass through: the non-precipitation overlays `#333e48` and `#ffffff`, and `#ac00db` (>60 mm/h), for which MeteoSwiss publishes no legend entry
- Centre pointer (`_updateCenterMarker`) is an `L.divIcon` marker: it lives in the markerPane (z-index 600), so the per-frame radar layer in the overlayPane (400) cannot cover it. Passing a custom `className` replaces Leaflet's `leaflet-div-icon` default, so none of its white-box styling applies — only `.center-marker-dot` is drawn. It tracks `_getCenter()` on config/hass changes and only calls `setLatLng` when the coordinates actually change (hass updates are constant)

**Time label formatting** (`_formatTime`):
- Locale precedence: `config.locale` → `hass.locale.language` → `hass.language` → `en-CH`
- `hass.language` alone resolves `en` to **en-US**, which is why English installs saw `8/18/2026, 3:35 AM`
- Clock precedence: `config.time_format` (`12`/`24`) → `hass.locale.time_format` (also handles `system` via `navigator.language`'s resolved `hourCycle`) → locale default
- The 12/24 setting lives in the HA **user profile**, not Settings → System → General
- Keep `minute: 'numeric'`. Pairing `hour: 'numeric'` with `minute: '2-digit'` makes Intl *drop* the hour padding in CH locales (`03:35` → `3:35`)
- `hass.locale.date_format` (DMY/MDY/YMD) is deliberately not applied: Intl cannot reorder a date without switching locale, which would also switch the weekday language. `config.locale` is the coherent override

**Animation**:
- Fetches frame list from `animation.json`
- Each frame has `timestamp` and `radar_url` pointing to specific JSON
- Slider input uses throttled rendering (250ms) to reduce API load
- Time label updates immediately for responsive feel
- Auto-plays at 1 fps, can be paused with play/pause button
- Frame list is re-fetched every `REFRESH_INTERVAL_MS` (4 min) so long-lived dashboards don't loop a stale window; the current frame is preserved across a refresh by timestamp, not by index
- `default_time` config (`latest` | `now`) picks the initial frame and the fallback when the current frame ages out of the window
- Only the most recent `_renderFrame` request may draw (`_renderToken`), since the timer, slider and refresh can each have a fetch in flight
- `_reload()` (reload button, next to play/pause) stops both timers, then re-runs `_loadData()`: fresh frame list, index back to `default_time`, timers restarted, playback resumed. It intentionally does **not** re-init the map, so the user's pan/zoom survives. On a failed reload the `finally` block restarts the timers so the card keeps animating the frames it already has
- Fetched frames are cached in `_frameCache` (Map, `FRAME_CACHE_LIMIT` entries, insertion-order eviction) and pruned on refresh to the frames still in the window. A frame is fetched once, not once per animation loop — this is what keeps the CORS proxy from rate limiting
- Timers are cleared in `disconnectedCallback`; the map is torn down there and rebuilt in `connectedCallback` on re-attach

## TypeScript Configuration

- Target: ES2020, Module: ESNext
- Strict mode enabled with `noImplicitAny`, `strictNullChecks`
- Uses `experimentalDecorators` for Lit decorators
- `useDefineForClassFields: false` for Lit compatibility

## Development Notes

- Local development proxies MeteoSwiss API through http-server (`-P` flag)
- Production URLs point to `https://www.meteoswiss.admin.ch`
- Home Assistant config provides center coordinates, falls back to Bern
- Card must implement `setConfig()` and `getCardSize()` for Home Assistant
- Global `customCards` array registration makes it appear in card picker

## HACS Integration

The repository is configured for HACS (Home Assistant Community Store):

- `hacs.json`: Defines repository metadata with `content_in_root: false` since files are in `dist/`
- `info.md`: Displayed in HACS UI with installation instructions
- Build output (`dist/`) MUST be committed to git for HACS to work
- Card registration uses `window.customCards` with proper TypeScript global declaration
- Uses `customElements.get()` check to prevent duplicate registration

**Important**: After making changes:
1. Run `npm run build` to generate production bundle
2. Commit both source and `dist/` files
3. Tag releases for HACS version tracking (`git tag v1.0.0`)

## Custom Integration (Backend Proxy)

> **NOTE: this integration is not currently in the repository.** It existed only in
> the initial commit (`81953f7`) and was removed; the card talks to MeteoSwiss
> through a browser-side CORS proxy instead (see the API client notes above).
> The section below describes that removed code and is kept for reference — a
> single repo cannot be registered under two HACS categories, which is the
> obstacle to shipping the card and the integration together.

### Location
`custom_components/meteoswiss_precipitation/` (removed — see `git show 81953f7`)

### Files
- `__init__.py` - Integration setup, registers HTTP view
- `api.py` - `MeteoSwissRadarView` HTTP endpoint handler
- `manifest.json` - HACS/HA metadata
- `README.md` - Integration documentation

### How It Works
1. Registers `/api/meteoswiss/*` endpoint in Home Assistant
2. Proxies requests to `https://www.meteoswiss.admin.ch/product/output/*`
3. Adds CORS headers to responses
4. Handles errors, timeouts, and caching (5min)
5. Uses `aiohttp` for async HTTP requests

### API Flow
```
Card → /api/meteoswiss/versions.json → Integration → MeteoSwiss API → Integration → Card
```

### Development
- Symlink to `~/.homeassistant/custom_components/` for testing
- Enable debug logging in `configuration.yaml`
- Test with: `curl http://localhost:8123/api/meteoswiss/versions.json`
