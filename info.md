# MeteoSwiss Precipitation Radar Card

A high-performance, interactive weather radar card for Home Assistant, featuring high-resolution Swiss boundary masking, logical time-slider controls, and responsive design.

## Features

- **🇨🇭 Swiss-Focused Map**: Automatically masks areas outside Switzerland with a dark overlay to focus attention on the relevant weather data.
- **High Resolution**: Uses high-quality vector boundaries for precise masking.
- **Interactive Controls**:
  - **Time Slider**: Drag to scrub through radar history and forecast.
  - **Play/Pause**: Animate the precipitation progression.
  - **Instant Time Feedback**: Time label updates immediately as you drag the slider.
- **Responsive**: Automatically adjusts height to fit your dashboard layout (supports `panel: true` or grid layouts).
- **Smart Constraints**: Prevents panning/zooming away from the Swiss region so you never get lost.
- **Performance Optimized**: Throttled data fetching ensures smooth interaction even on slower networks.

## Configuration

Add to your dashboard using the UI card selector, or manually:

```yaml
type: "custom:meteoswiss-radar-card"
zoom_level: 12  # Optional: Default zoom level (7-21). Default is 12
```

### Configuration Options

| Option       | Type    | Default | Description                                                                 |
| :----------- | :------ | :------ | :-------------------------------------------------------------------------- |
| `type`       | string  | **Required** | Must be `custom:meteoswiss-radar-card`.                                     |
| `zoom_level` | integer | `12`    | Initial zoom level of the map. Min: 7, Max: 21.                             |

The map automatically centers on your Home Assistant zone location (latitude/longitude specified in HA configuration). If that is not set, it defaults to Bern, Switzerland.

## How It Works

This card fetches real-time precipitation data from MeteoSwiss's public API. Due to browser security (CORS restrictions), requests are routed through a CORS proxy service to access the MeteoSwiss data. This is a common solution for browser-based applications accessing APIs without CORS headers.
