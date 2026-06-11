import { useEffect, useState } from 'react';
import { fetchWeather, fetchAirQuality, fetchHistoricalAverage } from '../lib/openMeteo.js';
import { fetchPollen } from '../lib/pollen.js';
import { fetchAlerts } from '../lib/alerts.js';
import { isDemo, demoStateFor } from '../lib/demoData.js';
import { isFictional, fictionalStateFor } from '../lib/fictionalCities.js';

// Weather changes slowly, and Open-Meteo's free tier is rate-limited per IP — so
// refresh every 10 min (not every minute, which an always-on display can use to
// burn through the daily quota and get 429s that surface as "Failed to fetch").
// After a failed fetch, retry sooner so a transient throttle recovers quickly.
const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;

const INITIAL = {
  loading: true,
  weather: null,
  weatherError: null,
  air: null,
  pollen: null,
  pollenError: null,
  historical: null,
  alerts: [],
  updatedAt: null
};

// Turn raw fetch failures into something friendlier than "Failed to fetch".
function friendly(reason) {
  const m = reason?.message || String(reason || 'error');
  if (/failed to fetch|networkerror|load failed|err_failed/i.test(m)) {
    return 'weather service busy — retrying…';
  }
  return m;
}

// Fetches weather + air quality + pollen + historical baseline for one location,
// independently (one failing never blanks the others), and refreshes on a timer.
// Demo and fictional cities short-circuit to fabricated, on-theme data (no network).
export function useLocationWeather(location) {
  const demo = isDemo();
  const fictional = isFictional(location);
  const theme = location?.theme;
  const lat = location?.latitude;
  const lng = location?.longitude;
  const tz = location?.timeZone;

  const [state, setState] = useState(() => {
    if (demo) return demoStateFor(location?.key) || INITIAL;
    if (fictional) return fictionalStateFor(theme) || INITIAL;
    return INITIAL;
  });

  useEffect(() => {
    if (demo) return undefined;

    // `active` guards against a stale in-flight fetch resolving after the location
    // changed (e.g. switching a real city to a fictional one) and clobbering it.
    let active = true;
    let timer = null;

    if (fictional) {
      // Fictional weather is dynamic (a function of the clock), so regenerate
      // periodically — it's all local computation, no network.
      setState(fictionalStateFor(theme) || INITIAL);
      const t = setInterval(() => {
        if (active) setState(fictionalStateFor(theme) || INITIAL);
      }, 5 * 60 * 1000);
      return () => {
        active = false;
        clearInterval(t);
      };
    }

    if (lat == null || lng == null) return undefined;

    const run = async () => {
      const loc = { latitude: lat, longitude: lng, timeZone: tz };
      const [w, a, p, h, al] = await Promise.allSettled([
        fetchWeather(loc),
        fetchAirQuality(loc),
        fetchPollen(loc),
        fetchHistoricalAverage(loc),
        fetchAlerts(loc)
      ]);
      if (!active) return; // location changed mid-flight — drop the stale result

      const weatherOk = w.status === 'fulfilled';
      setState((prev) => ({
        loading: false,
        // Keep the last good values when a refresh fails (transient rate-limit /
        // network blip) rather than blanking the card; only show an error if we
        // have nothing to show yet.
        weather: weatherOk ? w.value : prev.weather,
        weatherError: !weatherOk && !prev.weather ? friendly(w.reason) : null,
        air: a.status === 'fulfilled' ? a.value : prev.air,
        pollen: p.status === 'fulfilled' ? p.value : prev.pollen,
        pollenError: p.status === 'rejected' ? p.reason : p.status === 'fulfilled' ? null : prev.pollenError,
        historical: h.status === 'fulfilled' ? h.value : prev.historical,
        alerts: al.status === 'fulfilled' ? al.value : prev.alerts,
        updatedAt: weatherOk ? new Date() : prev.updatedAt
      }));

      // Normal cadence on success; quicker retry after a failure.
      if (active) timer = setTimeout(run, weatherOk ? REFRESH_MS : RETRY_MS);
    };

    setState((s) => ({ ...s, loading: true }));
    run();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [demo, fictional, theme, lat, lng, tz]);

  return state;
}
