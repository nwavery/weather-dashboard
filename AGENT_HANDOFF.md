# AGENT_HANDOFF.md

A brain-dump for the next agent/developer picking up this project. Written 2026-06 after a long build session. Read this before touching anything — there are several non-obvious gotchas (timezones, caching, rate limits, Glance APIs) that will waste your time if you rediscover them.

---

## 1. What this is

A real-time **weather dashboard**: per-location live clock, current conditions, hourly + 5-day forecast, metrics (humidity/dew/wind/UV), **air quality** (US AQI/PM2.5/ozone), **pollen/allergens** (tree/grass/weed), a 10-year historical temperature comparison, and an "immersive sky" visual treatment (weather-reactive gradients + animations). Plus a bunch of fun: **18 fictional pop-culture cities**, a **TV/kiosk mode**, and a separate **native Android app + 2×2 widget**.

- **Stack:** React + Vite (SPA) → built to static, served by a small **Express** server on **Google Cloud Run**, fronted by **Firebase Hosting**.
- **Live:** https://skyglance.web.app  (primary, what the user uses)

---

## 2. Live URLs & infrastructure

| Thing | Value |
|---|---|
| GCP project ID | `my-project-1470748322434` |
| GCP project number | `902310692765` |
| Cloud Run service | `weather-dashboard` (region `us-central1`) |
| Cloud Run URL (deterministic) | `https://weather-dashboard-902310692765.us-central1.run.app` |
| Cloud Run URL (`.a.run.app`) | `https://weather-dashboard-43oaosiovq-uc.a.run.app` |
| Firebase Hosting (primary) | `https://skyglance.web.app` (+ `skyglance.firebaseapp.com`) |
| Pollen key | `POLLEN_API_KEY` in **Secret Manager**, injected into Cloud Run (pollen works) |

- **Firebase Hosting** is a **full proxy** (`firebase.json`: rewrite `**` → Cloud Run service `weather-dashboard`). It passes Cloud Run response headers through (incl. `Cache-Control`). The user set this up from Cloud Shell. The repo `firebase.json` lives in **PR #7 (draft, not merged)** — skyglance is already running regardless.
- **CI/CD:** `cloudbuild.yaml` + a Cloud Build trigger → **push to `main` builds the image and deploys to Cloud Run** (~90–130 s). Image deploys preserve env vars (`ALLOWED_ORIGINS`) and the pollen secret.
- **`deploy/deploy.sh`** is the one-shot manual deploy (enables APIs, creates the pollen key/secret, sets IAM, deploys, auto-locks `ALLOWED_ORIGINS`).

### `ALLOWED_ORIGINS` (important)
`/api/pollen` only answers requests whose `Origin`/`Referer` host is in `ALLOWED_ORIGINS`. It must list every host the app is served from, e.g.:
```
https://skyglance.web.app,https://skyglance.firebaseapp.com,https://weather-dashboard-902310692765.us-central1.run.app,https://weather-dashboard-43oaosiovq-uc.a.run.app
```
`gcloud run services update ... --update-env-vars '^@^ALLOWED_ORIGINS=...'` **replaces** the whole value — easy to drop a host and get pollen 403s on that URL (this bit us once with the `.a.run.app` host).

---

## 3. Architecture & data flow

```
Browser (React SPA)
  ├─ forecast / air quality / archive(history) / geocoding ──▶ Open-Meteo  (KEYLESS, called directly from each user's IP)
  └─ /api/pollen ──▶ Cloud Run (Express) ──▶ Google Pollen API            (key from Secret Manager; server-cached 6h)
```

**Critical mental model:** only **pollen** goes through our backend. Everything else is the **browser hitting Open-Meteo directly**. Consequences:
- Scales across users (per-IP Open-Meteo limits; 50 users on 50 IPs are independent).
- A single always-on display (TV) can rate-limit *itself* — see §7.
- Pollen is the shared/cached one (6h server cache → many users of the same city collapse to ~1 upstream call).

---

## 4. Repo layout

```
index.html                 Vite entry; favicon.svg link + theme-color
vite.config.js             React plugin; dev proxy /api -> :8080
public/favicon.svg         sun-behind-cloud icon (matches the theme)
src/
  main.jsx, App.jsx        App.jsx: TV detection, fit-to-screen, keep-awake, fullscreen btn, rotate wiring
  components/
    WeatherCard.jsx        the card; derives sky gradient/animation/phase, fictional overrides, twin-suns
    WeatherAnimation.jsx   canvas/CSS FX (rain/snow/cloud/fog/thunder/sun/stars) + getSkyGradient()
    DailyForecast.jsx      5-day; renders naive local date strings (no tz re-conversion)
    HourlyForecast.jsx     hourly strip; renders naive local time strings (no tz re-conversion)
    Metrics.jsx            humidity/dew/wind/UV
    AirQuality.jsx         AQI badge + PM2.5/O3 + pollen chips (Tree/Grass/Weed)
    EditableName.jsx       ✏️ rename input (+ datalist of fictional names) and 🔁 rotate button
    FullscreenButton.jsx   ⛶ fullscreen toggle (webkit fallback for Silk)
  hooks/
    useClock.js            ticks every second
    useLocations.js        location state, geolocation, search (updateLocation), fictional interception, rotation timers
    useLocationWeather.js  fetch weather/air/pollen/history; 10-min refresh; keep-last-good; retry; demo/fictional short-circuit
  lib/
    openMeteo.js           fetchWeather/fetchAirQuality/fetchHistoricalAverage/geocodeCity/reverseGeocode; tzParam()
    pollen.js              fetchPollen() -> /api/pollen
    format.js              tempClass, formatTemperature, formatClock, getTimePhase (dawn/day/dusk/night), aqiInfo, pollenClass
    demoData.js            ?demo=1 harness (4 deterministic cards)
    fictionalCities.js     18 fictional cities registry + helpers (see §8)
    keepAwake.js           Screen Wake Lock + canvas-MediaStream video fallback (TV)
  data/weatherCodes.js     WMO code -> {description, icon (OpenWeatherMap), animation}
server/
  index.js                 Express: /api/healthz, /api/pollen, static (cache headers), SPA fallback
  pollen.js                pollen proxy: key injection, origin allowlist, 6h cache, per-IP rate limit
Dockerfile                 multi-stage (build Vite, run Express)
cloudbuild.yaml            build + deploy to Cloud Run on push to main
deploy/deploy.sh           one-shot Cloud Run setup/deploy
android/                   WeatherGlance native app + 2x2 Glance widget (see §9) — on branch, NOT merged
```

---

## 5. Dev & deploy workflow (how this session operated)

- **Web changes ship to `main`** via: branch off `origin/main` → commit → push → open PR → **squash-merge** → Cloud Build auto-deploys → poll skyglance for the new bundle hash.
- **Git identity for commits:** `user.email noreply@anthropic.com`, `user.name Claude` (a stop-hook flags commits that aren't this as "Unverified").
- **Branches of note:**
  - `claude/festive-albattani-RdCSp` — the original "designated" dev branch; holds **PR #7 (firebase.json, draft)**.
  - `claude/android-weather-widget` — **PR #8 (Android app, draft, unmerged)**.
  - `main` — everything else has been merged here.
- **Deploy confirmation recipe:** after merge, get the new asset hash from a local `npm run build` (`dist/assets/index-*.js` / `.css`) and poll `https://skyglance.web.app/` until the HTML references it. Server change only? Poll a header instead (e.g. `Cache-Control: no-cache` on `/`).

### Local development
```bash
npm install
npm run dev                     # Vite UI on :5173 (hot reload; proxies /api -> :8080)
POLLEN_API_KEY=... npm start    # Express API on :8080 (only needed for pollen)
# or full built app on one port:
POLLEN_API_KEY=... npm run serve   # http://localhost:8080
```
Weather/air-quality need **no key**; only pollen does (else it shows "not configured").

### Offline/no-setup test modes
- `?demo=1` → 4 deterministic cards exercising every weather effect (no network/geo/pollen).
- Search a **fictional city** (Rivendell, Pandora…) → themed fake data, zero network.
- `?rotateMs=2000` → make the rotate feature cycle every 2 s instead of 10 min.

---

## 6. Feature inventory (all merged to `main` & live unless noted)

- **Immersive sky redesign** (won a 3-way design competition): full-bleed weather-reactive gradients by condition + time-of-day; FX in `WeatherAnimation.jsx` (angled rain, snow, parallax clouds, fog, thunder+lightning, starfield + shooting stars at night, animated sun + god-rays by day). `prefers-reduced-motion` respected.
- **Air Quality & Allergens** section (AQI/PM2.5/O₃ + tree/grass/weed pollen).
- **10-year historical** temp comparison ("vs 10y avg ↑ 6° warmer") — Open-Meteo archive API, today's (max+min)/2 vs the mean of the same calendar day over the prior 10 years; cached 12h.
- **Responsive grid** + **centering fix** (the cards-container is shrink-to-fit under `#root`'s flex centering — needs an explicit width or it collapses to 1 column; see git history of the centering PR).
- **TV / kiosk mode** (§ below): fullscreen button, overscan-safe insets, fit-to-screen scaling, keep-awake.
- **18 fictional cities** + **per-card rotation** + **twin suns (Mos Eisley)** + Easter eggs (The Shire weed = Very High).
- **Favicon** + theme-color.
- **Caching** headers (no-cache index.html, immutable assets).
- **Native Android app** (`android/`, PR #8, **not merged**).

---

## 7. Subsystem deep-dives & HARD-WON GOTCHAS

### 7a. Open-Meteo rate limits → "Failed to fetch"
- Open-Meteo is keyless but **rate-limited per IP** (~10k/day; also per-minute/hour). A throttled response is **HTTP 429 with no CORS header**, so the browser `fetch` rejects as **`net::ERR_FAILED` → "Failed to fetch"** (not a clean status). Don't assume that's our bug.
- We refresh **every 10 min** (`REFRESH_MS` in `useLocationWeather.js`), not 60 s — the old 60 s on an always-on TV exhausted the quota. On failure we **keep the last-good data** (don't blank the card) and **retry in 60 s** (`RETRY_MS`). Different Open-Meteo subdomains (`api.`, `air-quality-api.`, `archive-api.`) have **separate** limits — forecast can 429 while air-quality is fine.

### 7b. TIMEZONES (this caused two separate bugs — read carefully)
- Forecast `hourly.time` / `daily.time` are **naive local-to-the-location strings** (e.g. `2026-06-04T17:00`), which is what Open-Meteo returns with `timezone=auto`.
- **Render them directly. Do NOT re-apply `timeZone` when formatting.** `HourlyForecast`/`DailyForecast` parse the naive string as browser-local and format **without** a `timeZone` option — re-applying the zone double-converts and shifts hours/days (e.g. London showed "11 PM" at a 4:30 PM clock from a US-Central browser).
- **Fictional cities** must generate their times in the **city's** wall-clock via `nowInZone(tz)` (in `fictionalCities.js`), or the filter that finds "first future hour" lands near the end of the 24-entry array (Pandora/Auckland showed only 3 ticks starting at 8 PM).
- **The sandbox browser runs in UTC**, which *masks* these bugs. When verifying tz issues with Playwright, set `timezoneId: 'America/Chicago'` (the user's zone) in `newContext`.

### 7c. POLLEN / weed = "None" (this is correct, not a bug)
- Researched and confirmed: Google Pollen API **omits `indexInfo`** for a pollen type that is "out of season **and** low count" (their documented behavior). So weed coming back `null` for OKC/Boston in June = Google saying "out of season/none," **and Google's own weather app shows the same `0/4 None`**. AccuWeather's "Low" is just the **floor of its scale**, not meaningful pollen. Ragweed (the dominant US weed) season is **late July–Oct (peak Sept)**.
- We render the omitted case as **"None"** (matches Google's app); tooltip says "none right now (out of season)". `server/pollen.js` `normalizeType()` maps it to `{value:null, category:'n/a'|'Out of season'}`; `AirQuality.jsx` `PollenItem` turns that into "None".
- **No easy way to "fill the gap":** Open-Meteo pollen is **Europe-only** (CAMS) and lacks US/ragweed; Tomorrow.io & Ambee have US weed but **require API keys** (and would just echo the "Low" floor). BreezoMeter *is* Google now. Conclusion: Google is the best US source and is behaving correctly.

### 7d. CACHING (caused repeated "hard-refresh to see changes")
- `server/index.js`: **`index.html` → `Cache-Control: no-cache`** (always revalidate → new deploys land on a normal reload) and **`/assets/*` → `immutable, max-age=1y`** (safe; Vite content-hashes the filenames). Firebase passes these through.
- Before this, users got stale JS after a deploy until a hard refresh. If someone reports "my change isn't showing," suspect a cached `index.html` first.

### 7e. Sky/animation system
- `WeatherCard.jsx` computes: `info` (from `weatherCodes`), `timePhase` (`getTimePhase`), `animation` (the `type`), `skyGrad` (`getSkyGradient(animation, timePhase)`), and an `anim-<type>` + `sky-phase-<phase>` class. The gradient is applied via the `--sky-gradient` CSS var on the card; `.sky-bg` reads it.
- `WeatherAnimation` renders precipitation/cloud/fog/thunder, or for clear sky: **SunGlow** (dawn/day/dusk) vs **StarCanvas** (night), driven by `timePhase`.
- **`.sun-orb` MUST use `aspect-ratio: 1`**, not `height: %` — a `%` height resolves against the (taller) card height and renders a vertical ellipse. **Twin suns** (Mos Eisley): a `twinSuns` prop threads `WeatherCard → WeatherAnimation → SunGlow`, which renders a second `.sun-orb.sun-orb--twin` (CSS positions it upper-right, smaller, pulsing out of phase).

### 7f. TV / kiosk mode (`html.tv`)
- UA-detected in `App.jsx` (`Silk|AFT…|Tizen|webOS|GoogleTV|BRAVIA|…`) → adds `tv` class.
- CSS (`html.tv`, `html.tv-fit`): overscan-safe body insets, tighter spacing/fonts, hourly kept but compacted.
- **Fit-to-screen scaling** (`App.jsx` `useLayoutEffect`): measures `.container` and applies `transform: scale()` to fit the viewport height (TVs are short & wide; cards are tall). `html.tv-fit` sets `overflow:hidden` so the unscaled layout box doesn't add scroll. Re-runs via `ResizeObserver` + timers as data loads.
- **Fullscreen** (`FullscreenButton.jsx`): Fullscreen API with **`webkitRequestFullscreen` fallback** (Silk needs it).
- **Keep-awake** (`keepAwake.js`, TV-only): Screen Wake Lock API + a hidden muted `<video>` fed by a 2×2 canvas `MediaStream` (the "media playing" trick). Re-acquires on visibility/fullscreen change. **Caveat:** Fire TV's OS screensaver can still override the browser — the reliable backstop is the device setting (Settings → Display & Sounds → Screensaver).

---

## 8. Fictional cities (`src/lib/fictionalCities.js`)

18 cities. Each entry stores **weather params** under `weather: ({...})` (NOT a built object — note the parens), plus `gradient`, `anim`, `phase`, `condition`, `world` (badge), `air`, `pollen`, optional `twinSuns`.

- `fictionalStateFor(id)` builds the forecast **lazily** via `makeWeather(c.weather, c.timeZone)` (fresh times each render, in the city's tz — see §7b).
- `findFictional(query)` matches name/alias (used by `useLocations.updateLocation` to intercept the search before geocoding; switching back to a real city clears `fictional`/`theme`).
- `fictionalByIndex(i)` powers the **rotate** feature.
- `fictionalTheme(id)` → `{gradient, anim, phase, condition, className: 'fic-<id>', twinSuns}` consumed by `WeatherCard`.
- `FICTIONAL_NAMES` feeds the `<datalist>` in `EditableName.jsx` (autocomplete).
- Custom `::before` glow overlays for some cities in `index.css` (`.fic-mustafar` embers, `.fic-pandora`/`.fic-emerald-city`/`.fic-coruscant`/`.fic-rivendell`/`.fic-atlantis`/`.fic-cloud-city`/`.fic-hundred-acre-wood`).
- **Easter eggs:** Mos Eisley twin suns; The Shire `weed: Very High` (`pollen(2,3,5)`).
- **Rotation** (in `useLocations.js`): per-card `rotating` state + a 10-min timer that advances `fictionalByIndex`; `?rotateMs=` overrides the interval for testing. Turning it on jumps to a random city immediately; off freezes on the current one. The 🔁 button lives in `EditableName.jsx`.

The full list: Mos Eisley, Hoth, Cloud City, Mustafar, Dagobah, Coruscant, Naboo (Star Wars); The Shire, Rivendell, Mordor (LOTR); Wakanda, Gotham City (Marvel/DC); Winterfell (GoT); Emerald City (Oz); Pandora (Avatar); Atlantis; Jurassic Park; Hundred Acre Wood.

---

## 9. Android app (`android/`) — status & Glance gotchas

- Native **Kotlin + Jetpack Glance** app with a **2×2 home-screen widget** (`com.weatherglance`). Mirrors the web data contract (Open-Meteo, WMO mapping); networking is `HttpURLConnection` + `org.json` (no extra deps). On branch **`claude/android-weather-widget`** = **PR #8 (draft, NOT merged)**.
- **It does NOT have the fictional cities** — that whole system is web-only. Adding it = port `fictionalCities.js` to Kotlin + intercept search + theme the app screen & widget. Offered, not done.
- **Cannot be compiled in this sandbox** (no Android SDK). First Android Studio Gradle sync is the real test.
- **Known Glance 1.1.0 compile pitfalls** (a build hit these; verified the right APIs via research):
  - `PreferencesGlanceStateDefinition` is in **`androidx.glance.state`** (NOT `androidx.glance.appwidget.state`). `getAppWidgetState`/`updateAppWidgetState` ARE in `androidx.glance.appwidget.state`.
  - `defaultWeight()` is a **member of `RowScope`/`ColumnScope`** — call `GlanceModifier.defaultWeight()` inside a `Row`/`Column`, **no import**.
  - **`actionStartActivity` in `glance-appwidget` 1.1.0 has NO reified `<T : Activity>()` overload** — only `actionStartActivity(intent: Intent, …)`. Use `actionStartActivity(Intent(context, MainActivity::class.java))` (get `context` via `LocalContext.current`), or a `ComponentName`.
- The user fixed these locally; they may or may not have pushed. **The sandbox is separate from their machine** — we can't pull their local edits; they must `git add/commit/push` from their Mac.

---

## 10. Verification & testing recipes

- **No automated test suite exists.** Verification has been headless Playwright. Worth adding: Vitest (weather-code/pollen/timezone/format logic, the rate-limit/stale-fetch behavior) + Playwright for rendering.
- Global Playwright in the sandbox: `export NODE_PATH=/opt/node22/lib/node_modules` then `node script.cjs` (or `npx playwright screenshot …`).
- Serve a build: `npm run build` then `PORT=42xx node server/index.js`.
- **Selector gotcha:** `.edit-location-btn` now matches **both** the ✏️ and the 🔁 rotate button — use `.edit-location-btn:not(.rotate-location-btn)` for the pencil.
- **Reproduce user-timezone bugs:** `newContext({ timezoneId: 'America/Chicago' })` (sandbox is UTC otherwise).
- **Fire TV repro:** Silk UA + a TV viewport (`/tmp/tvshot.cjs` has the UA + 1280×720/960×540).
- Drive the fictional cities by clicking the pencil and typing a name into `.location-input`.

---

## 11. Open items / ideas

- **PR #7** (firebase.json) — draft; merge if you want it in the repo (skyglance already runs via the inline config the user deployed).
- **PR #8** (Android app) — draft; had Glance compile errors (user fixed locally). Needs: confirm it builds, then merge. No fictional cities yet.
- **Android fictional cities** — port the registry + search + themed backgrounds (gradients easy; twin-suns/embers in Glance are harder).
- **Automated tests** — none yet (see §10).
- **Pollen** — current behavior is correct; only consider a keyed provider (Tomorrow.io/Ambee) if you truly need non-Google weed numbers.

---

_Personality note: the user enjoys the playful stuff (fictional worlds, twin suns, the Shire joke) and wants things to actually work on their Fire TV (Amazon Silk) and phone. They deploy to `main` and watch skyglance.web.app. Keep changes shippable and verify before claiming done._
