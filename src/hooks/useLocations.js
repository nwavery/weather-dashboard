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

// The second card's stable key (defined in useLocations' initial state).
const SECOND_CARD_KEY = 'boston';

// Persisted 🔁 choices. The second card rotates through the fictional worlds
// BY DEFAULT; an explicit toggle (or renaming the card) is remembered here so
// the default never fights a choice the user already made.
const ROTATE_PREF_KEY = 'weatherDashboardRotatePrefs';

function loadRotatePrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(ROTATE_PREF_KEY) || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function saveRotatePref(key, on) {
  try {
    const p = loadRotatePrefs();
    p[key] = !!on;
    localStorage.setItem(ROTATE_PREF_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

// Initial rotation state: URL param > saved 🔁 preference > default (the
// second card rotates unless the user has manually pinned a place to it).
function initialRotation(demo) {
  if (demo) return {};
  let param = null;
  try {
    param = new URLSearchParams(window.location.search).get('rotate');
  } catch {
    /* ignore */
  }
  if (param === '1' || param === 'true') return { [SECOND_CARD_KEY]: true };
  if (param === '0' || param === 'false') return {};
  const pref = loadRotatePrefs()[SECOND_CARD_KEY];
  if (typeof pref === 'boolean') return pref ? { [SECOND_CARD_KEY]: true } : {};
  return loadManual()[SECOND_CARD_KEY] ? {} : { [SECOND_CARD_KEY]: true };
}

// Manually chosen card locations (via the ✏️ rename) persist across reloads —
// IP lookup can be a county off (ISP blocks register at regional hubs), so an
// explicit choice must outrank it. The 📍 button clears the entry (back to auto).
const MANUAL_KEY = 'weatherDashboardManualLocations';

function loadManual() {
  try {
    const m = JSON.parse(localStorage.getItem(MANUAL_KEY) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

function saveManual(key, loc) {
  try {
    const m = loadManual();
    if (loc) m[key] = loc;
    else delete m[key];
    localStorage.setItem(MANUAL_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

// Re-apply a saved manual choice to a default card (fictional entries are
// re-derived from the live registry so stale saves can't brick a card).
function restoreManual(card, manual) {
  const m = manual[card.key];
  if (!m || !m.name) return card;
  if (m.fictional) {
    const fic = findFictional(m.name);
    return fic ? { ...card, ...fic } : card;
  }
  if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return card;
  return {
    ...card,
    name: m.name,
    latitude: m.latitude,
    longitude: m.longitude,
    timeZone: m.timeZone || card.timeZone,
    fictional: false,
    theme: null,
    badge: ''
  };
}

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

// Kiosk pin: ?city=Name fixes the first card to a place (geocoded once at
// load; fictional names work too). For wall frames/TVs that should never
// guess — no geolocation, no IP lookup, fully deterministic.
function pinnedCity() {
  try {
    const v = new URLSearchParams(window.location.search).get('city');
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
const PINNED_CITY = pinnedCity();

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

// IP-based geolocation for devices with no location services at all (Fire TV
// sticks, Raspberry Pi kiosks, desktops that deny the prompt). Keyless,
// CORS-friendly providers; home-ISP accuracy is metro-level — fine for weather.
async function ipLocate() {
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const d = await res.json();
      if (d?.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return {
          name: [d.city, d.region_code].filter(Boolean).join(', ') || 'Your area',
          latitude: d.latitude,
          longitude: d.longitude,
          timeZone: d?.timezone?.id || deviceTimeZone() || FALLBACK.timeZone
        };
      }
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch('https://geolocation-db.com/json/');
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        const resolved = await reverseGeocode(d.latitude, d.longitude).catch(() => null);
        return {
          name: resolved?.name || d.city || 'Your area',
          latitude: d.latitude,
          longitude: d.longitude,
          timeZone: resolved?.timeZone || deviceTimeZone() || FALLBACK.timeZone
        };
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

// Resolve the "current" location: browser geolocation, then IP-based location
// (TVs and kiosks have no GPS and never even show a prompt), then cache, then OKC.
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
    const ip = await ipLocate();
    if (ip) {
      saveCache(ip);
      setStatus('');
      return { location: ip, badge: 'Current Location' };
    }
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
  const [locations, setLocations] = useState(() => {
    if (demo) return DEMO_LOCATIONS;
    const manual = loadManual();
    return [
      { key: 'current', ...FALLBACK, badge: '' },
      { key: 'boston', name: 'Boston, MA', latitude: 42.3601, longitude: -71.0589, timeZone: 'America/New_York', badge: '' }
    ].map((card) => restoreManual(card, manual));
  });
  const [status, setStatus] = useState('');
  const [rotating, setRotating] = useState(() => initialRotation(demo)); // { [key]: true }
  const timers = useRef({}); // key -> intervalId
  const idxRef = useRef({}); // key -> next fictional index

  useEffect(() => {
    // A URL pin or a saved manual choice for the first card outranks auto-locate.
    if (demo || PINNED_CITY || loadManual().current) return undefined;
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

  // ?city= pin for the first card (replaces the geolocation flow entirely).
  useEffect(() => {
    if (demo || !PINNED_CITY) return undefined;
    let cancelled = false;
    (async () => {
      const fic = findFictional(PINNED_CITY);
      const place = fic || (await geocodeCity(PINNED_CITY).catch(() => null));
      if (cancelled) return;
      if (place) {
        setLocations((prev) => prev.map((l) => (l.key === 'current' ? { ...l, ...place } : l)));
        setStatus('');
      } else {
        setStatus(`Couldn't find pinned city "${PINNED_CITY}" — using fallback.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  // Re-resolve the device's location and point this card back at it (the way
  // back after renaming the "Current Location" card to somewhere else). Also
  // stops fictional rotation on the card so it doesn't wander off again.
  const locateCard = useCallback(async (key) => {
    if (demo) return { ok: false };
    saveManual(key, null); // back to auto-locate on future loads
    saveRotatePref(key, false); // "show MY location" — don't rotate away from it
    setRotating((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    const { location, badge } = await resolveCurrent(setStatus);
    setLocations((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...location, badge, fictional: false, theme: null } : l))
    );
    return { ok: true };
  }, [demo]);

  // Rename/relocate a card by geocoding the typed city name — or, if it matches
  // one of the fictional pop-culture cities, swap to its themed fake forecast.
  const updateLocation = useCallback(async (key, cityName) => {
    if (demo) return { ok: false };
    // "Current Location" (and friends) typed in the rename box → re-geolocate.
    if (/^(current( location)?|my location|here)$/i.test(cityName.trim())) {
      return locateCard(key);
    }
    // A rename is an explicit choice: stop rotation (now and on future loads)
    // so the picked place isn't silently swapped 10 minutes later.
    const pin = (place) => {
      setRotating((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
      saveRotatePref(key, false);
      setLocations((prev) => prev.map((l) => (l.key === key ? { ...l, ...place } : l)));
    };
    const fic = findFictional(cityName);
    if (fic) {
      pin(fic);
      saveManual(key, { name: fic.name, fictional: true });
      return { ok: true };
    }
    try {
      const geo = await geocodeCity(cityName);
      if (!geo) return { ok: false };
      // Clear any fictional flag if this card was previously a fictional city.
      pin({ ...geo, fictional: false, theme: null, badge: '' });
      saveManual(key, { name: geo.name, latitude: geo.latitude, longitude: geo.longitude, timeZone: geo.timeZone });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }, [demo, locateCard]);

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
      const next = !rotating[key];
      saveRotatePref(key, next);
      setRotating((prev) => ({ ...prev, [key]: next }));
    },
    [demo, rotating]
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

  return { locations, status, updateLocation, locateCard, rotating, toggleRotate };
}
