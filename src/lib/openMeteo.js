// Keyless Open-Meteo clients: forecast, air quality, historical archive, and
// forward/reverse geocoding. Lightweight in-memory caches keep refreshes cheap.
// Each takes optional { baseUrl, headers, fetch, cache, signal, timeoutMs } last
// (see fetchTimeout.js); baseUrl replaces that endpoint's own host, listed below.
import { formatDateYYYYMMDD } from './format.js';
import { fetchWithTimeout, baseOf, cacheFor, checkDeadline, ttlMap, initFor, headerTimeout, withDeadline } from './fetchTimeout.js';
import { persistentCache } from './persistentCache.js';

const HISTORICAL_LOOKBACK_YEARS = 10;
const AQ_TTL_MS = 15 * 60 * 1000; // 15 min
const HIST_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

const FORECAST_BASE = 'https://api.open-meteo.com';
const AIR_BASE = 'https://air-quality-api.open-meteo.com';
const ARCHIVE_BASE = 'https://archive-api.open-meteo.com';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com';
const BIGDATACLOUD_BASE = 'https://api.bigdatacloud.net';

const aqCache = ttlMap(AQ_TTL_MS);
// The decade-wide archive scan is the most expensive call we make and its
// answer doesn't change for the rest of the day, so it outlives a reload.
const histCache = persistentCache('sg:hist', { ttlMs: HIST_TTL_MS });
const histShared = { get: (key) => histCache.get(key) ?? undefined, set: (key, data) => histCache.set(key, data) };

// Open-Meteo requires a valid IANA timezone. A missing/blank value would be
// serialized as the literal string "undefined" and rejected with HTTP 400, so
// fall back to `auto` (Open-Meteo infers the zone from the coordinates).
function tzParam(timeZone) {
  return timeZone && typeof timeZone === 'string' ? encodeURIComponent(timeZone) : 'auto';
}

export function fetchWeather(location, opts) {
  return withDeadline(opts, (signal) => fetchWeatherNow(location, opts, signal));
}

async function fetchWeatherNow(location, opts, signal) {
  const { latitude, longitude, timeZone } = location;
  const url =
    `${baseOf(opts, FORECAST_BASE)}/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,dew_point_2m,precipitation,cloud_cover` +
    `&hourly=temperature_2m,weather_code,precipitation,cloud_cover,precipitation_probability` +
    `&minutely_15=precipitation,weather_code&forecast_minutely_15=16` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weather_code` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${tzParam(timeZone)}&forecast_days=6`;
  const res = await fetchWithTimeout(url, initFor(opts, undefined, signal), headerTimeout(opts));
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  if (!data?.current || !data?.daily || !data?.hourly) throw new Error('Incomplete weather data');
  return data;
}

export async function fetchAirQuality(location, opts) {
  const base = baseOf(opts, AIR_BASE);
  const cache = cacheFor(opts, { shared: aqCache, name: 'air', base, ttlMs: AQ_TTL_MS });
  const key = `${location.latitude},${location.longitude}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  return withDeadline(opts, (signal) => fetchAirQualityNow(location, opts, signal, base, cache, key));
}

async function fetchAirQualityNow(location, opts, signal, base, cache, key) {
  const url =
    `${base}/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=us_aqi,pm2_5,ozone&timezone=${tzParam(location.timeZone)}`;
  const res = await fetchWithTimeout(url, initFor(opts, undefined, signal), headerTimeout(opts));
  if (!res.ok) throw new Error(`Air quality API ${res.status}`);
  const data = await res.json();
  if (!data?.current) throw new Error('Incomplete air quality data');
  return cache.set(key, data.current);
}

// Average mean temp on today's month/day over the last N years (excludes this year).
export async function fetchHistoricalAverage(location, opts) {
  const base = baseOf(opts, ARCHIVE_BASE);
  const tz = location.timeZone;
  const todayStr = formatDateYYYYMMDD(new Date(), tz);
  const mmdd = todayStr.substring(5);
  const currentYear = parseInt(todayStr.substring(0, 4), 10);

  // The date is part of the key, not just the TTL: this is the average for
  // *today's* month/day, so an entry cached last night must not be reused
  // after local midnight even though its 12 h TTL hasn't run out.
  const cache = cacheFor(opts, { shared: histShared, name: 'hist', base, ttlMs: HIST_TTL_MS });
  const cacheKey = `${location.latitude},${location.longitude}:${tz}:${todayStr}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  return withDeadline(opts, (signal) => fetchHistoricalNow(location, opts, signal, base, cache, cacheKey, mmdd, currentYear));
}

async function fetchHistoricalNow(location, opts, signal, base, cache, cacheKey, mmdd, currentYear) {
  const tz = location.timeZone;

  const end = new Date();
  end.setDate(end.getDate() - 1); // yesterday, to avoid a partial current day
  const start = new Date();
  start.setFullYear(start.getFullYear() - HISTORICAL_LOOKBACK_YEARS);

  const url =
    `${base}/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&daily=temperature_2m_mean&temperature_unit=fahrenheit&timezone=${tzParam(tz)}` +
    `&start_date=${formatDateYYYYMMDD(start, tz)}&end_date=${formatDateYYYYMMDD(end, tz)}`;
  const res = await fetchWithTimeout(url, initFor(opts, undefined, signal), headerTimeout(opts));
  if (!res.ok) throw new Error(`Archive API ${res.status}`);
  const data = await res.json();
  const dates = data?.daily?.time;
  const means = data?.daily?.temperature_2m_mean;
  if (!Array.isArray(dates) || !Array.isArray(means) || dates.length !== means.length) {
    throw new Error('Unexpected archive data');
  }

  let sum = 0;
  let count = 0;
  for (let i = 0; i < dates.length; i++) {
    const ds = dates[i];
    const mean = means[i];
    if (typeof ds !== 'string' || ds.length < 10 || typeof mean !== 'number' || Number.isNaN(mean)) continue;
    if (ds.substring(5) === mmdd && parseInt(ds.substring(0, 4), 10) !== currentYear) {
      sum += mean;
      count += 1;
    }
  }
  if (count === 0) throw new Error('No matching historical days');

  return cache.set(cacheKey, { baseline: sum / count, years: count });
}

export async function geocodeCity(name, opts) {
  if (!name || !name.trim()) return null;
  return withDeadline(opts, (signal) => geocodeCityNow(name, opts, signal));
}

async function geocodeCityNow(name, opts, signal) {
  const res = await fetchWithTimeout(
    `${baseOf(opts, GEOCODING_BASE)}/v1/search?name=${encodeURIComponent(name.trim())}&count=1&language=en&format=json`,
    initFor(opts, undefined, signal),
    headerTimeout(opts)
  );
  if (!res.ok) throw new Error(`Geocoding API ${res.status}`);
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  return { name: displayName(r), latitude: r.latitude, longitude: r.longitude, timeZone: r.timezone };
}

// Open-Meteo reverse first, BigDataCloud as a CORS-friendly fallback.
// `baseUrl` replaces the Open-Meteo host and `fallbackBaseUrl` the
// BigDataCloud one; `headers` and `fetch` apply to both. Like the rest of this
// function, running out of `timeoutMs` or an aborted `signal` gives null.
export async function reverseGeocode(latitude, longitude, opts) {
  checkDeadline(opts);
  try {
    return await withDeadline(opts, (signal) => reverseGeocodeNow(latitude, longitude, opts, signal));
  } catch {
    return null;
  }
}

async function reverseGeocodeNow(latitude, longitude, opts, signal) {
  try {
    const res = await fetchWithTimeout(
      `${baseOf(opts, GEOCODING_BASE)}/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`,
      initFor(opts, undefined, signal),
      headerTimeout(opts)
    );
    if (res.ok) {
      const data = await res.json();
      const r = data?.results?.[0];
      if (r) return { name: displayName(r), latitude, longitude, timeZone: r.timezone };
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetchWithTimeout(
      `${baseOf({ baseUrl: opts?.fallbackBaseUrl }, BIGDATACLOUD_BASE)}/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      initFor(opts, undefined, signal),
      headerTimeout(opts)
    );
    if (res.ok) {
      const data = await res.json();
      const name = data.city || data.locality || data.principalSubdivision || data.countryName || 'Your location';
      return { name, latitude, longitude, timeZone: data?.timezone?.ianaTimeZone };
    }
  } catch {
    /* fall through */
  }
  return null;
}

function displayName(r) {
  let name = r.name;
  if (r.admin1 && r.country_code && r.admin1 !== r.name) name += `, ${r.admin1}`;
  else if (r.country && r.country !== r.name) name += `, ${r.country}`;
  return name;
}
