// Keyless Open-Meteo clients: forecast, air quality, historical archive, and
// forward/reverse geocoding. Lightweight in-memory caches keep refreshes cheap.
import { formatDateYYYYMMDD } from './format.js';

const HISTORICAL_LOOKBACK_YEARS = 10;
const AQ_TTL_MS = 15 * 60 * 1000; // 15 min
const HIST_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

const aqCache = new Map();
const histCache = new Map();

// Open-Meteo requires a valid IANA timezone. A missing/blank value would be
// serialized as the literal string "undefined" and rejected with HTTP 400, so
// fall back to `auto` (Open-Meteo infers the zone from the coordinates).
function tzParam(timeZone) {
  return timeZone && typeof timeZone === 'string' ? encodeURIComponent(timeZone) : 'auto';
}

export async function fetchWeather(location) {
  const { latitude, longitude, timeZone } = location;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,dew_point_2m` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${tzParam(timeZone)}&forecast_days=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  const data = await res.json();
  if (!data?.current || !data?.daily || !data?.hourly) throw new Error('Incomplete weather data');
  return data;
}

export async function fetchAirQuality(location) {
  const key = `${location.latitude},${location.longitude}`;
  const cached = aqCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=us_aqi,pm2_5,ozone&timezone=${tzParam(location.timeZone)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Air quality API ${res.status}`);
  const data = await res.json();
  if (!data?.current) throw new Error('Incomplete air quality data');
  aqCache.set(key, { expires: Date.now() + AQ_TTL_MS, data: data.current });
  return data.current;
}

// Average mean temp on today's month/day over the last N years (excludes this year).
export async function fetchHistoricalAverage(location) {
  const cacheKey = `${location.latitude},${location.longitude}:${location.timeZone}`;
  const cached = histCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const tz = location.timeZone;
  const todayStr = formatDateYYYYMMDD(new Date(), tz);
  const mmdd = todayStr.substring(5);
  const currentYear = parseInt(todayStr.substring(0, 4), 10);

  const end = new Date();
  end.setDate(end.getDate() - 1); // yesterday, to avoid a partial current day
  const start = new Date();
  start.setFullYear(start.getFullYear() - HISTORICAL_LOOKBACK_YEARS);

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&daily=temperature_2m_mean&temperature_unit=fahrenheit&timezone=${tzParam(tz)}` +
    `&start_date=${formatDateYYYYMMDD(start, tz)}&end_date=${formatDateYYYYMMDD(end, tz)}`;
  const res = await fetch(url);
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

  const result = { baseline: sum / count, years: count };
  histCache.set(cacheKey, { expires: Date.now() + HIST_TTL_MS, data: result });
  return result;
}

export async function geocodeCity(name) {
  if (!name || !name.trim()) return null;
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=1&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Geocoding API ${res.status}`);
  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  return { name: displayName(r), latitude: r.latitude, longitude: r.longitude, timeZone: r.timezone };
}

// Open-Meteo reverse first, BigDataCloud as a CORS-friendly fallback.
export async function reverseGeocode(latitude, longitude) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`
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
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
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
