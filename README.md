# MeteoSwiss Precipitation Radar Card

A high-performance, interactive weather radar card for Home Assistant, featuring high-resolution Swiss boundary masking, logical time-slider controls, and responsive design.

![Demo](docs/demo.gif)

## Features

*   **🇨🇭 Swiss-Focused Map**: Automatically masks areas outside Switzerland with a dark overlay to focus attention on the relevant weather data.
*   **High Resolution**: Uses high-quality vector boundaries for precise masking.
*   **Interactive Controls**:
    *   **Time Slider**: Drag to scrub through radar history and forecast.
    *   **Play/Pause**: Animate the precipitation progression.
    *   **Instant Time Feedback**: Time label updates immediately as you drag the slider.
*   **Responsive**: Automatically adjusts height to fit your dashboard layout (supports `panel: true` or grid layouts).
*   **Smart Constraints**: Prevents panning/zooming away from the Swiss region so you never get lost.
*   **Performance Optimized**: Throttled data fetching ensures smooth interaction even on slower networks.

## Installation

### 1. HACS (Recommended)

1.  Open HACS in Home Assistant.
2.  Go to **Frontend**.
3.  Click the **3-dot menu** in the top right -> **Custom repositories**.
4.  Add the URL of this repository.
5.  Select **Lovelace** as the category.
6.  Click **Add**.
7.  Click **Install** on the new card.
8.  Reload your browser.

### 2. Manual Installation

1.  Download the `meteoswiss-radar-card.js` file from the [releases page](https://github.com/khashashin/ha-meteoswiss-precipitation/releases) (or build it yourself using `npm run build` -> `dist/meteoswiss-radar-card.js`).
2.  Upload the file to your Home Assistant `www` folder (e.g., `/config/www/meteoswiss-radar-card.js`).
3.  Add the resource to your Home Assistant dashboard:
    *   Go to **Settings** > **Dashboards** > **Three Dots Icon (top right)** > **Resources**.
    *   Click **+ Add Resource**.
    *   **URL**: `/local/meteoswiss-radar-card.js`
    *   **Resource Type**: JavaScript Module.

### 2. Add to Dashboard

Use the "Manual" card configuration in your dashboard:

```yaml
type: "custom:meteoswiss-radar-card"
zoom_level: 12  # Optional: Default zoom level (7-21). Default is 12 (approx. city view)
```

## Configuration

| Option       | Type    | Default | Description                                                                 |
| :----------- | :------ | :------ | :-------------------------------------------------------------------------- |
| `type`       | string  | **Required** | Must be `custom:meteoswiss-radar-card`.                                     |
| `zoom_level` | integer | `12`    | Initial zoom level of the map. Min: 7, Max: 21.                             |

**Note**: The map automatically centers on your Home Assistant zone location (latitude/longitude specified in HA configuration). If that is not set, it defaults to Bern, Switzerland.

## Development

To build the project locally:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/khashashin/ha-meteoswiss-precipitation.git
    cd ha-meteoswiss-precipitation
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run development server**:
    ```bash
    npm start
    ```
    This will start a local server at `http://127.0.0.1:8080`.

4.  **Build for production**:
    ```bash
    npm run build
    ```
    The output file will be in `dist/meteoswiss-radar-card.js`.

## License

MIT