import { useCallback, useEffect, useState } from 'react';
import { reverseGeocode, geocodeCity } from '../lib/openMeteo.js';

const FALLBACK = {
  name: 'Oklahoma City, OK',
  latitude: 35.4676,
  longitude: -97.5164,
  timeZone: 'America/Chicago'
};

const CACHE_KEY = 'weatherDashboardCurrentLocation';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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
  const [locations, setLocations] = useState(() => [
    { key: 'current', ...FALLBACK, badge: '' },
    { key: 'boston', name: 'Boston, MA', latitude: 42.3601, longitude: -71.0589, timeZone: 'America/New_York', badge: '' }
  ]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { location, badge } = await resolveCurrent(setStatus);
      if (cancelled) return;
      setLocations((prev) => prev.map((l) => (l.key === 'current' ? { ...l, ...location, badge } : l)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rename/relocate a card by geocoding the typed city name.
  const updateLocation = useCallback(async (key, cityName) => {
    try {
      const geo = await geocodeCity(cityName);
      if (!geo) return { ok: false };
      setLocations((prev) => prev.map((l) => (l.key === key ? { ...l, ...geo, badge: '' } : l)));
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, []);

  return { locations, status, updateLocation };
}
