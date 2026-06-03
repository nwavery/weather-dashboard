import { useCallback, useEffect, useRef, useState } from 'react';
import { reverseGeocode, geocodeCity } from '../lib/openMeteo.js';
import { isDemo, DEMO_LOCATIONS } from '../lib/demoData.js';
import { findFictional, fictionalByIndex, FICTIONAL_COUNT } from '../lib/fictionalCities.js';

const FALLBACK = {
  name: 'Oklahoma City, OK',
  latitude: 35.4676,
  longitude: -97.5164,
  timeZone: 'America/Chicago'
};

const CACHE_KEY = 'weatherDashboardCurrentLocation';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// Fictional-city rotation cadence (10 min). Overridable via ?rotateMs= for testing.
function rotateInterval() {
  try {
    const v = parseInt(new URLSearchParams(window.location.search).get('rotateMs'), 10);
    if (Number.isFinite(v) && v >= 500) return v;
  } catch {
    /* ignore */
  }
  return 10 * 60 * 1000;
}
const ROTATE_MS = rotateInterval();

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.timestamp || Date.now() - p.timestamp > CACHE_TTL_MS) return null;
    if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return null;
    return { name: p.name || FALLBACK.name, latitude: p.latitude, longitude: p.longitude, timeZone: p.timeZone || FALLBACK.timeZone };
  } catch {
    return null;
  }
}

function saveCache(loc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...loc, timestamp: Date.now() }));
  } catch {
    /* ignore */
  }
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 300000
    });
  });
}

// The device's own timezone — the most accurate zone for the user's current
// location, and a reliable fallback when reverse-geocoding doesn't supply one.
function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Resolve the "current" location: try the browser, fall back to cache, then OKC.
async function resolveCurrent(setStatus) {
  const cached = loadCache();
  try {
    const pos = await getPosition();
    const { latitude, longitude } = pos.coords || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') throw new Error('bad coords');
    const resolved = await reverseGeocode(latitude, longitude);
    // Always pin a valid IANA timezone (reverse geocoders may omit one);
    // otherwise downstream Open-Meteo calls 400 on `timezone=undefined`.
    const timeZone = resolved?.timeZone || deviceTimeZone() || FALLBACK.timeZone;
    const location = resolved
      ? { ...resolved, timeZone }
      : { ...FALLBACK, latitude, longitude, timeZone };
    saveCache(location);
    setStatus(resolved ? '' : 'Using your coordinates; could not resolve a place name.');
    return { location, badge: resolved ? 'Current Location' : '' };
  } catch {
    if (cached) {
      setStatus('Using your last known location; live location unavailable.');
      return { location: cached, badge: '' };
    }
    setStatus('Using fallback: Oklahoma City (location access unavailable).');
    return { location: FALLBACK, badge: '' };
  }
}

export function useLocations() {
  const demo = isDemo();
  const [locations, setLocations] = useState(() =>
    demo
      ? DEMO_LOCATIONS
      : [
          { key: 'current', ...FALLBACK, badge: '' },
          { key: 'boston', name: 'Boston, MA', latitude: 42.3601, longitude: -71.0589, timeZone: 'America/New_York', badge: '' }
        ]
  );
  const [status, setStatus] = useState('');
  const [rotating, setRotating] = useState({}); // { [key]: true }
  const timers = useRef({}); // key -> intervalId
  const idxRef = useRef({}); // key -> next fictional index

  useEffect(() => {
    if (demo) return undefined;
    let cancelled = false;
    (async () => {
      const { location, badge } = await resolveCurrent(setStatus);
      if (cancelled) return;
      setLocations((prev) => prev.map((l) => (l.key === 'current' ? { ...l, ...location, badge } : l)));
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  // Rename/relocate a card by geocoding the typed city name — or, if it matches
  // one of the fictional pop-culture cities, swap to its themed fake forecast.
  const updateLocation = useCallback(async (key, cityName) => {
    if (demo) return { ok: false };
    const fic = findFictional(cityName);
    if (fic) {
      setLocations((prev) => prev.map((l) => (l.key === key ? { ...l, ...fic } : l)));
      return { ok: true };
    }
    try {
      const geo = await geocodeCity(cityName);
      if (!geo) return { ok: false };
      // Clear any fictional flag if this card was previously a fictional city.
      setLocations((prev) =>
        prev.map((l) => (l.key === key ? { ...l, ...geo, fictional: false, theme: null, badge: '' } : l))
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [demo]);

  // Advance a card to the next fictional city (wraps around).
  const advanceRotation = useCallback((key) => {
    const i = idxRef.current[key] ?? 0;
    idxRef.current[key] = i + 1;
    const place = fictionalByIndex(i);
    setLocations((prev) => prev.map((l) => (l.key === key ? { ...l, ...place } : l)));
  }, []);

  const toggleRotate = useCallback(
    (key) => {
      if (demo) return;
      setRotating((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [demo]
  );

  // Start/stop a 10-min timer per rotating card. Turning rotation on jumps to a
  // random city immediately so it's obvious, then advances on each tick.
  useEffect(() => {
    Object.keys(rotating).forEach((key) => {
      const on = rotating[key];
      if (on && !timers.current[key]) {
        idxRef.current[key] = Math.floor(Math.random() * FICTIONAL_COUNT);
        advanceRotation(key);
        timers.current[key] = setInterval(() => advanceRotation(key), ROTATE_MS);
      } else if (!on && timers.current[key]) {
        clearInterval(timers.current[key]);
        delete timers.current[key];
      }
    });
  }, [rotating, advanceRotation]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach(clearInterval);
      timers.current = {};
    },
    []
  );

  return { locations, status, updateLocation, rotating, toggleRotate };
}
