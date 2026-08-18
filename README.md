# MeteoSwiss Precipitation Radar Card

A high-performance, interactive weather radar card for Home Assistant, featuring high-resolution Swiss boundary masking, logical time-slider controls, and responsive design.

![Demo](docs/demo.gif)
<img width="1030" height="804" alt="image" src="https://github.com/user-attachments/assets/5220697b-f9ae-44ea-b5a6-a1aef0783e96" />


## Features

*   **🇨🇭 Swiss-Focused Map**: Automatically masks areas outside Switzerland with a dark overlay to focus attention on the relevant weather data.
*   **High Resolution**: Uses high-quality vector boundaries for precise masking.
*   **Location Pointer**: A small dot marks the coordinates the card is centred on — your Home Assistant location, or the configured override.
*   **Official Colours**: Uses the MeteoSwiss precipitation palette (0.2 → 60 mm/h), so the card matches what the MeteoSwiss app shows.
*   **Interactive Controls**:
    *   **Time Slider**: Drag to scrub through radar history and forecast.
    *   **Play/Pause**: Animate the precipitation progression.
    *   **Reload**: Fetch the newest frames and restart the animation, without reloading the map or losing your pan/zoom.
    *   **Instant Time Feedback**: Time label updates immediately as you drag the slider.
*   **Responsive**: Automatically adjusts height to fit your dashboard layout (supports `panel: true` or grid layouts).
*   **Smart Constraints**: Prevents panning/zooming away from the Swiss region so you never get lost.
*   **Always Current**: Refreshes the frame list every 4 minutes, so a dashboard left open keeps showing live radar instead of an ageing forecast.
*   **Performance Optimized**: Throttled data fetching ensures smooth interaction even on slower networks.

## Installation

### 1. HACS (Recommended)

1.  Open HACS in Home Assistant.
2.  Go to **Frontend**.
3.  Click the **3-dot menu** in the top right -> **Custom repositories**.
4.  Add the URL of this repository.
5.  Select **Lovelace** (or **Dashboard** if using HACS 2.0+) as the category.
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
default_time: now  # Optional: start on the frame closest to the current time
```

## Configuration

| Option         | Type    | Default    | Description                                                                 |
| :------------- | :------ | :--------- | :-------------------------------------------------------------------------- |
| `type`         | string  | **Required** | Must be `custom:meteoswiss-radar-card`.                                   |
| `zoom_level`   | integer | `12`       | Initial zoom level of the map. Min: 7, Max: 21.                             |
| `default_time` | string  | `latest`   | Which frame the card starts on. `latest` uses the last frame (the end of the forecast window); `now` uses the frame closest to the current time. |
| `proxy_url`    | string  | shared     | CORS proxy to fetch MeteoSwiss data through. See [CORS Proxy Information](#cors-proxy-information). |
| `locale`       | string  | HA's       | BCP 47 tag used to format the time label, e.g. `de-CH`, `fr-CH`, `en-CH`. Overrides Home Assistant's language. |
| `time_format`  | string  | HA's       | `24` or `12`. Overrides Home Assistant's clock setting. |

### Date and time formatting

By default the label follows Home Assistant: the language from your profile, and the **Time format** setting from **your user profile** (click your name in the sidebar → *Time format*), not from **Settings → System → General**.

The catch is that Home Assistant's language `en` resolves to US formatting, so an English installation shows `Tuesday, 8/18/2026, 3:35 AM`. Set `locale` to get Swiss formatting while keeping whatever language you like:

| `locale` | Result |
| :------- | :----- |
| *(unset, HA language `en`)* | `Tuesday, 8/18/2026, 3:35 AM` |
| `en-CH` | `Tuesday, 18.08.2026, 03:35` |
| `de-CH` | `Dienstag, 18.8.2026, 03:35` |
| `fr-CH` | `mardi, 18.08.2026 03:35` |
| `it-CH` | `martedì 18/08/2026, 03:35` |

Home Assistant's profile **Date format** setting (DMY/MDY/YMD) is not applied — `Intl` cannot reorder a date without switching locale, and doing so would also switch the weekday's language. Use `locale` instead; it sets the date order, the clock and the weekday language coherently.

**Note**: The map automatically centers on your Home Assistant zone location (latitude/longitude specified in HA configuration). If that is not set, it defaults to Bern, Switzerland.

**Note on playback**: the card auto-plays at 1 fps and loops through the whole window, so `default_time` sets where playback *begins*, not where it stays. Press pause to hold a frame.

The frame list is re-fetched every 4 minutes. When that happens the card stays on the frame you were watching; if that frame has aged out of the window, it falls back to your `default_time` choice.

## CORS Proxy Information

MeteoSwiss serves its radar data without an `Access-Control-Allow-Origin` header (and answers `OPTIONS` with `405`), so a browser cannot fetch it directly. A proxy is required.

By default the card uses the shared public proxy `corsproxy.io`. That is a free service shared by every user of this card, so **you may hit HTTP 429 (rate limited)**. If that happens, point the card at a proxy of your own:

```yaml
type: "custom:meteoswiss-radar-card"
proxy_url: "https://your-worker.your-name.workers.dev/?url={url}"
```

The `{url}` placeholder is replaced with the URL-encoded MeteoSwiss URL. If you leave the placeholder out, the encoded URL is appended to whatever you provide (the `corsproxy.io` convention).

### Running your own proxy (Cloudflare Workers, free tier)

This takes about five minutes and costs nothing. You need a Cloudflare account — **no domain and no credit card required**. The Workers free plan allows [100,000 requests per day](https://developers.cloudflare.com/workers/platform/limits/); this card uses roughly 1,000 per day per dashboard, so you have plenty of headroom.

#### Step 1 — Create a free Cloudflare account

Sign up at **[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)** and confirm the verification email. Skip any prompt to add a domain — you do not need one.

#### Step 2 — Create the Worker

1. Open the dashboard: **[dash.cloudflare.com](https://dash.cloudflare.com/)**
2. In the left sidebar, choose **Compute (Workers)** — older dashboards call this **Workers & Pages**
3. Click **Create**, then **Start with Hello World!** (older dashboards: **Create application** → **Create Worker**)
4. Give it a name, for example `meteoswiss-proxy`. **This name becomes part of your URL**, so pick something you'll recognise.
5. Click **Deploy**

You now have a working "Hello World" Worker. The next step replaces its code.

#### Step 3 — Paste in the proxy code

1. Click **Edit code** (on the Worker's page, or **Continue to project** → **Edit code**)
2. Select everything in the editor and delete it
3. Paste this in its place:

```js
export default {
  async fetch(request) {
    const target = new URL(request.url).searchParams.get('url');

    // Only ever proxy MeteoSwiss, so this cannot be used as an open relay.
    if (!target || !target.startsWith('https://www.meteoswiss.admin.ch/')) {
      return new Response('Forbidden', { status: 403 });
    }

    const upstream = await fetch(target, {
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    const response = new Response(upstream.body, upstream);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
```

4. Click **Deploy** (top right), and confirm

#### Step 4 — Copy your Worker URL

On the Worker's overview page you'll find its address, in the form:

```
https://meteoswiss-proxy.<your-subdomain>.workers.dev
```

`<your-subdomain>` is chosen once per account when you create your first Worker.

#### Step 5 — Check that it works

Paste this into a browser tab, replacing the host with your own:

```
https://meteoswiss-proxy.<your-subdomain>.workers.dev/?url=https%3A%2F%2Fwww.meteoswiss.admin.ch%2Fproduct%2Foutput%2Fversions.json
```

You should see a page of JSON. If you instead see:

| Response | Cause |
| :------- | :---- |
| `Forbidden` (403) | The `?url=` parameter is missing, or does not start with `https://www.meteoswiss.admin.ch/` |
| `Error 1101` / exception | The code was pasted incompletely — repeat Step 3 |
| Cloudflare 404 page | Wrong URL; re-copy it from the Worker's overview page |

#### Step 6 — Point the card at your Worker

In YAML:

```yaml
type: "custom:meteoswiss-radar-card"
proxy_url: "https://meteoswiss-proxy.<your-subdomain>.workers.dev/?url={url}"
```

Or in the visual editor, put the same value in the **CORS Proxy URL** field.

Do not forget the `?url={url}` suffix — `{url}` is the placeholder the card replaces with the (encoded) MeteoSwiss address.

Reload your dashboard. The 429 errors should be gone.

#### Prefer the command line?

```bash
npm create cloudflare@latest -- meteoswiss-proxy
# choose: "Hello World example" -> "Worker only" -> "JavaScript"

# replace the contents of src/index.js with the code from Step 3, then:
npx wrangler deploy
```

#### A note on sharing

Your Worker URL is public. The allowlist in the code means nobody can use it to proxy anything other than MeteoSwiss, but someone who found the URL could still consume your daily quota. For a private setup, add a secret to the path or query and reject requests without it.

**Privacy Note**: Weather data requests go through the CORS proxy. No personal or Home Assistant data is sent—only publicly available MeteoSwiss URLs are accessed.

### Request volume

The card caches every radar frame it has fetched, in memory and via the browser's HTTP cache (frame URLs are timestamped and immutable, and MeteoSwiss serves them with `max-age=86400`). A frame is therefore fetched once, not once per animation loop. In steady state the card makes only a couple of requests per 5 minutes, no matter how long the dashboard stays open.

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
