// Nearest NWS station's *observed* present weather (api.weather.gov, keyless,
// US-only). Open-Meteo is a forecast model and can miss or mistime localized
// rain that's actually falling — we've watched a station report Light Rain while
// Open-Meteo still showed overcast/0 mm. When a recent observation reports
// precipitation, we let ground truth override the rendered condition so the card
// matches reality. Non-US points (no station) and any API hiccup resolve to null,
// leaving the model's value untouched.

const STATION_TTL_MS = 24 * 60 * 60 * 1000; // the nearest station is stable
const OBS_TTL_MS = 2 * 60 * 1000; // don't re-pull the obs faster than this
export const OBS_MAX_AGE_MS = 90 * 60 * 1000; // ignore observations older than this

const stationCache = new Map();
const obsCache = new Map();
const NWS_HEADERS = { Accept: 'application/geo+json' };
const FETCH_TIMEOUT_MS = 8000; // never let a slow NWS call stall the whole refresh

async function nwsFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: NWS_HEADERS, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Resolve (and cache) the nearest observation station for a point.
async function nearestStation(latitude, longitude) {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const hit = stationCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const ptRes = await nwsFetch(`https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`);
  if (!ptRes.ok) throw new Error(`points ${ptRes.status}`);
  const stationsUrl = (await ptRes.json())?.properties?.observationStations;
  if (!stationsUrl) throw new Error('no stations url');

  const stRes = await nwsFetch(stationsUrl);
  if (!stRes.ok) throw new Error(`stations ${stRes.status}`);
  const props = (await stRes.json())?.features?.[0]?.properties;
  const station = props?.stationIdentifier
    ? { id: props.stationIdentifier, name: props.name || props.stationIdentifier }
    : null;

  stationCache.set(key, { expires: Date.now() + STATION_TTL_MS, data: station });
  return station;
}

// Latest observation for a location as { code, observedAt, station }, or null
// when there's no station (non-US), no current precipitation, or any error.
export async function fetchObservation(location) {
  const { latitude, longitude } = location;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  try {
    const station = await nearestStation(latitude, longitude);
    if (!station) return null;

    const hit = obsCache.get(station.id);
    if (hit && hit.expires > Date.now()) return hit.data;

    const res = await nwsFetch(`https://api.weather.gov/stations/${station.id}/observations/latest`);
    if (!res.ok) throw new Error(`obs ${res.status}`);
    const props = (await res.json())?.properties;
    const code = precipCodeFromObservation(props);
    const data = code == null ? null : { code, observedAt: props?.timestamp || null, station: station.name };

    obsCache.set(station.id, { expires: Date.now() + OBS_TTL_MS, data });
    return data;
  } catch {
    return null; // non-US, network, or parse failure — fall back to the model
  }
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

// The observed code to render *now*, or null when there's no fresh precip
// override (no obs, not precipitating, or the observation has gone stale).
export function observedOverride(obs) {
  if (!obs || typeof obs.code !== 'number' || !obs.observedAt) return null;
  if (Date.now() - new Date(obs.observedAt).getTime() > OBS_MAX_AGE_MS) return null;
  return obs.code;
}
