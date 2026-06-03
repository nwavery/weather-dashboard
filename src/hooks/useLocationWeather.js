import { useCallback, useEffect, useState } from 'react';
import { fetchWeather, fetchAirQuality, fetchHistoricalAverage } from '../lib/openMeteo.js';
import { fetchPollen } from '../lib/pollen.js';
import { isDemo, demoStateFor } from '../lib/demoData.js';
import { isFictional, fictionalStateFor } from '../lib/fictionalCities.js';

const REFRESH_MS = 60000;

const INITIAL = {
  loading: true,
  weather: null,
  weatherError: null,
  air: null,
  pollen: null,
  pollenError: null,
  historical: null,
  updatedAt: null
};

// Fetches weather + air quality + pollen + historical baseline for one location,
// independently (one failing never blanks the others), and refreshes every minute.
// Demo and fictional cities short-circuit to fabricated, on-theme data (no network).
export function useLocationWeather(location) {
  const demo = isDemo();
  const fictional = isFictional(location);
  const theme = location?.theme;
  const [state, setState] = useState(() => {
    if (demo) return demoStateFor(location?.key) || INITIAL;
    if (fictional) return fictionalStateFor(theme) || INITIAL;
    return INITIAL;
  });

  const lat = location?.latitude;
  const lng = location?.longitude;
  const tz = location?.timeZone;

  const load = useCallback(async () => {
    if (lat == null || lng == null) return;
    const loc = { latitude: lat, longitude: lng, timeZone: tz };
    const [w, a, p, h] = await Promise.allSettled([
      fetchWeather(loc),
      fetchAirQuality(loc),
      fetchPollen(loc),
      fetchHistoricalAverage(loc)
    ]);
    setState({
      loading: false,
      weather: w.status === 'fulfilled' ? w.value : null,
      weatherError: w.status === 'rejected' ? w.reason?.message || 'error' : null,
      air: a.status === 'fulfilled' ? a.value : null,
      pollen: p.status === 'fulfilled' ? p.value : null,
      pollenError: p.status === 'rejected' ? p.reason : null,
      historical: h.status === 'fulfilled' ? h.value : null,
      updatedAt: new Date()
    });
  }, [lat, lng, tz]);

  useEffect(() => {
    if (demo) return undefined;
    if (fictional) {
      setState(fictionalStateFor(theme) || INITIAL);
      return undefined;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    load();
    const id = setInterval(() => {
      if (active) load();
    }, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [load, demo, fictional, theme]);

  return state;
}
