# MeteoSwiss Precipitation Radar Card

A high-performance, interactive weather radar card for Home Assistant, featuring high-resolution Swiss boundary masking, logical time-slider controls, and responsive design.

## Features

- **🇨🇭 Swiss-Focused Map**: Automatically masks areas outside Switzerland with a dark overlay to focus attention on the relevant weather data.
- **High Resolution**: Uses high-quality vector boundaries for precise masking.
- **Location Pointer**: A small dot marks the coordinates the card is centred on — your Home Assistant location, or the configured override.
- **Interactive Controls**:
  - **Time Slider**: Drag to scrub through radar history and forecast.
  - **Play/Pause**: Animate the precipitation progression.
  - **Reload**: Fetch the newest frames and restart the animation, without reloading the map or losing your pan/zoom.
  - **Instant Time Feedback**: Time label updates immediately as you drag the slider.
- **Responsive**: Automatically adjusts height to fit your dashboard layout (supports `panel: true` or grid layouts).
- **Smart Constraints**: Prevents panning/zooming away from the Swiss region so you never get lost.
- **Always Current**: Refreshes the frame list every 4 minutes, so a dashboard left open keeps showing live radar instead of an ageing forecast.
- **Performance Optimized**: Throttled data fetching ensures smooth interaction even on slower networks.

## Configuration

Add to your dashboard using the UI card selector, or manually:

```yaml
type: "custom:meteoswiss-radar-card"
zoom_level: 12  # Optional: Default zoom level (7-21). Default is 12
default_time: now  # Optional: start on the frame closest to the current time
```

### Configuration Options

| Option         | Type    | Default    | Description                                                                 |
| :------------- | :------ | :--------- | :-------------------------------------------------------------------------- |
| `type`         | string  | **Required** | Must be `custom:meteoswiss-radar-card`.                                   |
| `zoom_level`   | integer | `12`       | Initial zoom level of the map. Min: 7, Max: 21.                             |
| `default_time` | string  | `latest`   | Which frame the card starts on. `latest` uses the last frame (the end of the forecast window); `now` uses the frame closest to the current time. |
| `proxy_url`    | string  | shared     | CORS proxy to fetch MeteoSwiss data through, e.g. `https://your-worker.workers.dev/?url={url}`. Leave unset to use the shared public proxy. |

The card auto-plays at 1 fps and loops through the whole window, so `default_time` sets where playback begins, not where it stays. The frame list is re-fetched every 4 minutes; the card keeps the frame you were watching, or falls back to `default_time` if that frame has aged out of the window.

The map automatically centers on your Home Assistant zone location (latitude/longitude specified in HA configuration). If that is not set, it defaults to Bern, Switzerland.

## How It Works

This card fetches real-time precipitation data from MeteoSwiss's public API. MeteoSwiss serves that data without CORS headers, so a browser cannot fetch it directly and requests are routed through a CORS proxy.

The default is a shared public proxy, which is rate limited across all users of this card. If you see HTTP 429 errors, set `proxy_url` to a proxy of your own. The README has a [step-by-step guide for setting up a free Cloudflare Worker](https://github.com/khashashin/ha-meteoswiss-precipitation#running-your-own-proxy-cloudflare-workers-free-tier) — about five minutes, no domain or credit card needed.

Radar frames are cached once fetched, so leaving the card open does not keep re-downloading the same frames.
