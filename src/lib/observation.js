// Nearest NWS station's *observed* present weather (api.weather.gov, keyless,
// US-only). Open-Meteo is a forecast model and can both miss and overstate
// localized rain — we've watched a station report Light Rain while Open-Meteo
// showed overcast/0 mm, then ~90 min later watched Open-Meteo claim "violent rain
// showers" while the station read Partly Cloudy. A recent station observation is
// ground truth, so we let it override the rendered condition BOTH ways: add real
// precip the model missed, and drop model precip the station doesn't see. Non-US
// points (no station) and any API hiccup resolve to null, leaving the model's
// value untouched.
//
// fetchObservation takes optional { baseUrl, headers, fetch, cache, signal,
// timeoutMs } (see fetchTimeout.js). NWS asks every client for a User-Agent,
// so a server caller should send one in `headers`.

import { persistentCache } from './persistentCache.js';
import {
  fetchWithTimeout,
  baseOf,
  cacheFor,
  changesResult,
  checkDeadline,
  alreadyAborted,
  ttlMap,
  initFor,
  headerTimeout,
  withDeadline
} from './fetchTimeout.js';

const STATION_TTL_MS = 24 * 60 * 60 * 1000; // the nearest station is stable
const OBS_TTL_MS = 2 * 60 * 1000; // don't re-pull the obs faster than this
export const OBS_MAX_AGE_MS = 90 * 60 * 1000; // ignore observations older than this
// …except that a "dry" report keeps some weight for longer: when the NWS feed
// stalls, a station that said dry within this window still outweighs a weak
// radar echo (see radarToCode). 4 h, because routine reports are hourly and an
// outage of 2-3 h leaves the last one up to an hour older than the outage.
export const OBS_DRY_TRUST_MS = 240 * 60 * 1000;

// Which station is nearest a point doesn't change, and resolving it costs two
// chained API calls — so it outlives a reload. The observations themselves
// stay in memory: a 2-minute TTL is worth nothing across a restart.
const stationCache = persistentCache('sg:station', { ttlMs: STATION_TTL_MS });
const stationShared = { get: (key) => stationCache.get(key) ?? undefined, set: (key, data) => stationCache.set(key, data) };
const obsCache = ttlMap(OBS_TTL_MS);
const NWS_HEADERS = { Accept: 'application/geo+json' };
const NWS_BASE = 'https://api.weather.gov';
// Each NWS request gets 8 s to start answering. The timer stops when headers
// arrive, so a body that stalls after that is not bounded here: in the app the
// hook's 12 s race unblocks the card, and a server caller should pass
// `timeoutMs`, which covers the whole call.
const FETCH_TIMEOUT_MS = 8000;

function nwsFetch(url, opts, signal) {
  return fetchWithTimeout(url, initFor(opts, NWS_HEADERS, signal), headerTimeout(opts, FETCH_TIMEOUT_MS));
}

// The stations link to follow. NWS answers with an absolute api.weather.gov
// link: under another base it is followed through that base, so a proxy sees
// every call. A call with caller options never follows a link outside its own
// base, so the caller's headers can't reach a host it didn't name.
function stationsLink(stationsUrl, base, opts) {
  if (base !== NWS_BASE && stationsUrl.startsWith(`${NWS_BASE}/`)) return base + stationsUrl.slice(NWS_BASE.length);
  if (changesResult(opts) && !stationsUrl.startsWith(`${base}/`)) throw new Error('stations link outside base');
  return stationsUrl;
}

// Resolve (and cache) the nearest observation station for a point.
async function nearestStation(latitude, longitude, base, opts, signal) {
  const cache = cacheFor(opts, { shared: stationShared, name: 'station', base, ttlMs: STATION_TTL_MS });
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  // Wrapped rather than stored bare so a cached "no station here" (every
  // non-US point) is a hit and not re-queried on every refresh.
  const hit = cache.get(key);
  if (hit) return hit.station;

  const ptRes = await nwsFetch(`${base}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`, opts, signal);
  if (!ptRes.ok) throw new Error(`points ${ptRes.status}`);
  const stationsUrl = (await ptRes.json())?.properties?.observationStations;
  if (!stationsUrl) throw new Error('no stations url');

  const stRes = await nwsFetch(stationsLink(stationsUrl, base, opts), opts, signal);
  if (!stRes.ok) throw new Error(`stations ${stRes.status}`);
  const props = (await stRes.json())?.features?.[0]?.properties;
  const station = props?.stationIdentifier
    ? { id: props.stationIdentifier, name: props.name || props.stationIdentifier }
    : null;

  cache.set(key, { station });
  return station;
}

// Latest observation for a location as { precipCode, dry, observedAt, station },
// or null when there's no station (non-US), no usable reading, or any error.
// `precipCode` is the WMO code when precip is falling; `dry` is true when the
// station reported and saw none — so the caller can both add missed rain and
// drop model rain the station contradicts.
export async function fetchObservation(location, opts) {
  checkDeadline(opts);
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (alreadyAborted(opts)) return null;
  const base = baseOf(opts, NWS_BASE);
  try {
    return await withDeadline(opts, (signal) => latestObservation(latitude, longitude, base, opts, signal));
  } catch {
    return null; // non-US, network, timeout or parse failure: fall back to the model
  }
}

async function latestObservation(latitude, longitude, base, opts, signal) {
  const station = await nearestStation(latitude, longitude, base, opts, signal);
  if (!station) return null;

  const cache = cacheFor(opts, { shared: obsCache, name: 'obs', base, ttlMs: OBS_TTL_MS });
  const hit = cache.get(station.id);
  if (hit !== undefined) return hit;

  const res = await nwsFetch(`${base}/stations/${station.id}/observations/latest`, opts, signal);
  if (!res.ok) throw new Error(`obs ${res.status}`);
  const props = (await res.json())?.properties;
  const observedAt = props?.timestamp || null;
  const precipCode = precipCodeFromObservation(props);
  // Without a timestamp we can't trust freshness, so don't let it override.
  const data = observedAt ? { precipCode, dry: precipCode == null, observedAt, station: station.name } : null;

  return cache.set(station.id, data);
}

// Closest WMO code for *precipitation* in an NWS observation (rain / drizzle /
// snow / thunder / ice). Returns null for fog/haze/clear/cloudy: only precip the
// model might have missed should override the rendered sky. Reads the structured
// `presentWeather` tokens, the raw METAR strings, and the text description, so a
// blank field in one still gets picked up by another.
function precipCodeFromObservation(props) {
  const pw = Array.isArray(props?.presentWeather) ? props.presentWeather : [];
  const raw = pw.map((w) => w?.rawString || '').join(' ').toLowerCase(); // e.g. "-ra br"
  const words = (pw.map((w) => w?.weather || '').join(' ') + ' ' + (props?.textDescription || '')).toLowerCase();

  const heavy = raw.includes('+') || words.includes('heavy');
  const light = raw.includes('-') || words.includes('light');
  // word token (structured/text) OR a METAR pattern in the raw string
  const has = (word, metar) => words.includes(word) || (metar ? new RegExp(metar).test(raw) : false);

  // Order matters: thunder, then freezing types, then snow, then rain, drizzle.
  if (has('thunder', '\\bts')) return 95;
  if (has('freezing rain', 'fzra')) return heavy ? 67 : 66;
  if (has('freezing drizzle', 'fzdz')) return light ? 56 : 57;
  if (has('ice pellets', '\\bpl\\b') || has('sleet')) return 66;
  if (has('snow', '\\bsn\\b|\\bsg\\b')) return heavy ? 75 : light ? 71 : 73;
  if (has('rain', '\\bra\\b|shra')) return heavy ? 65 : light ? 61 : 63;
  if (has('drizzle', '\\bdz\\b')) return heavy ? 55 : light ? 51 : 53;
  return null; // fog / mist / haze / clear / cloudy → let the model keep the sky
}

// True when the station's latest report said dry within OBS_DRY_TRUST_MS, even
// if it's too old for freshObservation. Used only to gate the radar fallback.
export function recentDryObservation(obs, nowMs = Date.now()) {
  if (!obs || !obs.dry || !obs.observedAt) return false;
  const age = nowMs - new Date(obs.observedAt).getTime();
  return age >= 0 && age <= OBS_DRY_TRUST_MS;
}

// The observation to trust *now*, or null when there's none or it's gone stale
// (NWS issues special obs on precip changes and we re-pull every refresh, so a
// fresh reading reflects onset/cessation within minutes). Exactly 90 min old is
// still fresh. A future-stamped report counts as fresh, unlike in
// recentDryObservation.
export function freshObservation(obs, nowMs = Date.now()) {
  if (!obs || !obs.observedAt) return null;
  if (nowMs - new Date(obs.observedAt).getTime() > OBS_MAX_AGE_MS) return null;
  return obs;
}
