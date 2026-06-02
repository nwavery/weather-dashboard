# Weather Dashboard

A real-time weather dashboard (live clock, current conditions, hourly & 5-day
forecasts, **air quality**, and **pollen/allergen** levels) for multiple
locations. Built with **React + Vite** and served by a small **Express**
container on **Google Cloud Run**.

## Architecture

```
Browser (React SPA)
  ├─ weather / air quality / geocoding / history ──▶ Open-Meteo   (keyless, called directly)
  └─ /api/pollen ──▶ Cloud Run (Express) ──▶ Google Pollen API    (key from Secret Manager)
```

- **Weather & air quality are keyless** (Open-Meteo) and called straight from the
  browser — US AQI, PM2.5, and ozone work worldwide with no setup.
- **Pollen needs a key.** Open-Meteo's pollen data is Europe-only, so pollen
  (tree/grass/weed) comes from the **Google Pollen API**, which covers the US and
  65+ countries. The key is **never** shipped to the browser or committed to the
  repo — the front-end calls our own `/api/pollen`, and the Cloud Run server adds
  the key (read from **Secret Manager**) when it forwards the request to Google.
- The pollen proxy is protected by an **origin allowlist**, **caching** (pollen is
  a once-daily forecast), and **per-IP rate limiting** so a public endpoint can't
  be used to drain your quota/billing.

## Features

- Per-location live clock (timezone-aware) and current temperature / "feels like".
- Hourly forecast (next ~12 h) and 5-day daily forecast.
- Humidity, dew point, wind (speed + direction), UV index.
- Historical comparison: today's predicted average vs. the 10-year average for the date.
- **Air quality:** US AQI (with category), PM2.5, ground-level ozone.
- **Pollen:** tree / grass / weed levels (Google Universal Pollen Index 0–5).
- Editable locations (✏️ → geocoded via Open-Meteo) and current-location detection.
- Weather-driven animations (rain / snow / clouds), temperature-tinted cards.
- Auto-refresh every minute; responsive on desktop and mobile.

## Project structure

```
index.html              Vite entry
src/
  main.jsx, App.jsx
  components/            WeatherCard, Hourly/Daily forecasts, Metrics, AirQuality, …
  hooks/                 useClock, useLocationWeather, useLocations
  lib/                   openMeteo.js (keyless clients), pollen.js (calls /api), format.js
  data/weatherCodes.js
server/
  index.js              Express: serves dist/ + /api/pollen + /healthz
  pollen.js             Pollen proxy: key injection, cache, origin allowlist, rate limit
Dockerfile              Multi-stage: build Vite, run Express
deploy/deploy.sh        One-shot Cloud Run deploy (APIs, secret, IAM, deploy)
```

## Local development

```bash
npm install

# Option A — full app on one port (builds, then serves dist + API on :8080):
POLLEN_API_KEY=your_dev_key npm run serve
#   open http://localhost:8080

# Option B — hot-reloading UI + API in two terminals:
POLLEN_API_KEY=your_dev_key npm start   # Express API on :8080
npm run dev                             # Vite UI on :5173 (proxies /api -> :8080)
```

Weather and air quality work without any key. Pollen will return a friendly
"not configured" state until `POLLEN_API_KEY` is set.

## Deploy to Cloud Run

Prerequisites: a GCP project with billing enabled, and `gcloud` authenticated
(`gcloud auth login`). You'll also need a **Google Pollen API key** — the deploy
script enables the Pollen API and stores your key in Secret Manager for you.

```bash
chmod +x deploy/deploy.sh
PROJECT_ID=your-project-id ./deploy/deploy.sh
```

The script will:
1. Enable the `run`, `cloudbuild`, `secretmanager`, and `pollen` APIs.
2. Prompt for your Pollen API key and store it as the `pollen-api-key` secret.
3. Grant the Cloud Run runtime service account `secretAccessor` on that secret.
4. Build from source (Cloud Build) and deploy the service.

After the first deploy, re-run with `ALLOWED_ORIGINS` set to your service URL to
lock the pollen proxy to your site:

```bash
PROJECT_ID=your-project-id \
ALLOWED_ORIGINS="https://weather-dashboard-xxxxx-uc.a.run.app" \
./deploy/deploy.sh
```

### Server environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `POLLEN_API_KEY` | Google Pollen API key (from Secret Manager) | — (pollen disabled if unset) |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call `/api/pollen` | unset = open (dev) |
| `POLLEN_CACHE_TTL_MS` | Pollen cache lifetime | `21600000` (6 h) |
| `POLLEN_RATE_LIMIT` / `POLLEN_RATE_WINDOW_MS` | Per-IP rate limit | `60` per `60000` ms |
| `PORT` | Listen port | `8080` (set by Cloud Run) |

## Data sources

- [Open-Meteo](https://open-meteo.com/) — forecast, air quality, archive, geocoding (keyless)
- [Google Pollen API](https://developers.google.com/maps/documentation/pollen) — tree/grass/weed pollen
- BigDataCloud — reverse-geocoding fallback
- OpenWeatherMap — weather icon images

## License

MIT.
