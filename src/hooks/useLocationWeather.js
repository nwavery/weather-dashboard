import { useEffect, useState } from 'react';
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

    if (fictional) {
      setState(fictionalStateFor(theme) || INITIAL);
      return () => {
        active = false;
      };
    }

    if (lat == null || lng == null) return undefined;

    const run = async () => {
      const loc = { latitude: lat, longitude: lng, timeZone: tz };
      const [w, a, p, h] = await Promise.allSettled([
        fetchWeather(loc),
        fetchAirQuality(loc),
        fetchPollen(loc),
        fetchHistoricalAverage(loc)
      ]);
      if (!active) return; // location changed mid-flight — drop the stale result
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
    };

    setState((s) => ({ ...s, loading: true }));
    run();
    const id = setInterval(run, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [demo, fictional, theme, lat, lng, tz]);

  return state;
}
